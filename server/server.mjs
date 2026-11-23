import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, existsSync, statSync, createReadStream, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt = promisify(scryptCallback);
const hash = value => createHash('sha256').update(value).digest('hex');
const base = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 100_000;
export function createServer({ database = path.join(base, 'data', 'sana.db'), staticRoot = path.resolve(base, '../dist'), rateLimit = 30 } = {}) {
  if (database !== ':memory:') mkdirSync(path.dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, nickname TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS progress(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id TEXT NOT NULL, completed INTEGER NOT NULL, best_score INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id, lesson_id));`);
  const limits = new Map();
  const fail = (status, code) => { throw Object.assign(new Error(code), { status }); };
  function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) fail(413, 'BODY_TOO_LARGE'); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || Array.isArray(value) || typeof value !== 'object') fail(400,'BAD_JSON'); return value; } catch { fail(400,'BAD_JSON'); }
  }
  function authenticate(req) {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) fail(401,'UNAUTHORIZED');
    const user = db.prepare('SELECT u.id, u.username, u.nickname FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now());
    if (!user) fail(401,'UNAUTHORIZED');
    return user;
  }
  function issue(user) {
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),user.id,Date.now()+30*86400_000);
    return { token, user: { id:user.id, username:user.username, nickname:user.nickname } };
  }
  function getProgress(id) {
    return Object.fromEntries(db.prepare('SELECT lesson_id, completed, best_score, updated_at FROM progress WHERE user_id=?').all(id).map(r=>[r.lesson_id,{lessonId:r.lesson_id,completed:!!r.completed,bestScore:r.best_score,updatedAt:r.updated_at}]));
  }
  const server = http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    const origin = req.headers.origin;
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    if (origin && (allowed.includes(origin) || (!allowed.length && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)))) {
      res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
    }
    if(req.method==='OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      const pathname = new URL(req.url,'http://localhost').pathname;
      if(pathname==='/api/health' && req.method==='GET') return json(res,200,{ok:true,version:1});
      if(pathname.startsWith('/api/auth/') && req.method==='POST') {
        const key=req.socket.remoteAddress;
        const now=Date.now();
        for(const [k,v] of limits) if(v.until<now) limits.delete(k);
        const entry=limits.get(key)||{count:0,until:now+15*60_000}; entry.count++; limits.set(key,entry);
        if(entry.count>rateLimit) fail(429,'RATE_LIMIT');
        const data=await body(req);
        const username=typeof data.username==='string'?data.username.toLowerCase().trim():'';
        if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof data.password!=='string'||data.password.length<8||data.password.length>128) fail(400,'INVALID_CREDENTIALS');
        if(pathname==='/api/auth/register') {
          const nickname=typeof data.nickname==='string'?data.nickname.trim():'';
          if(nickname.length<1||nickname.length>30) fail(400,'INVALID_NICKNAME');
          if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) fail(409,'USERNAME_TAKEN');
          const salt=randomBytes(16).toString('hex'), passwordHash=(await scrypt(data.password,salt,64)).toString('hex');
          const user={id:randomBytes(16).toString('hex'),username,nickname};
          // Another concurrent request may have registered the same username while hashing.
          try { db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(user.id,username,nickname,salt,passwordHash,new Date().toISOString()); }
          catch(e) { if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) fail(409,'USERNAME_TAKEN'); throw e; }
          return json(res,201,issue(user));
        }
        if(pathname==='/api/auth/login') {
          const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
          const result=await scrypt(data.password,user?.salt||'00000000000000000000000000000000',64);
          if(!user||!timingSafeEqual(result,Buffer.from(user.password_hash,'hex'))) fail(401,'WRONG_LOGIN');
          return json(res,200,issue(user));
        }
        fail(404,'NOT_FOUND');
      }
      if(pathname.startsWith('/api/')) {
        const user=authenticate(req);
        if(pathname==='/api/me'&&req.method==='GET') return json(res,200,{user});
        if(pathname==='/api/logout'&&req.method==='POST') { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(req.headers.authorization.slice(7))); return json(res,200,{ok:true}); }
        if(pathname==='/api/me'&&req.method==='DELETE') {
          const data=await body(req), record=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
          if(typeof data.password!=='string'||data.password.length>128) fail(400,'INVALID_CREDENTIALS');
          if(!timingSafeEqual(await scrypt(data.password,record.salt,64),Buffer.from(record.password_hash,'hex'))) fail(401,'WRONG_LOGIN');
          db.prepare('DELETE FROM users WHERE id=?').run(user.id); return json(res,200,{ok:true});
        }
        if(pathname==='/api/progress'&&req.method==='GET') return json(res,200,{progress:getProgress(user.id)});
        if(pathname==='/api/progress'&&req.method==='PUT') {
          const {progress}=await body(req);
          if(!progress||Array.isArray(progress)||typeof progress!=='object'||Object.keys(progress).length>69) fail(400,'INVALID_PROGRESS');
          const rows=Object.entries(progress);
          for(const [id,p] of rows) {
            const match=/^g([1-4])-(\d{2})$/.exec(id);
            if(!match||+match[2]<1||+match[2]>[0,10,17,20,22][+match[1]]||!p||p.lessonId!==id||typeof p.completed!=='boolean'||!Number.isInteger(p.bestScore)||p.bestScore<0||p.bestScore>100||typeof p.updatedAt!=='string'||!Number.isFinite(Date.parse(p.updatedAt))) fail(400,'INVALID_PROGRESS');
          }
          db.exec('BEGIN IMMEDIATE');
          try {
            const upsert=db.prepare(`INSERT INTO progress VALUES (?,?,?,?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=MAX(progress.completed,excluded.completed), best_score=MAX(progress.best_score,excluded.best_score), updated_at=excluded.updated_at`);
            const stamp=new Date().toISOString();
            for(const [id,p] of rows) upsert.run(user.id,id,p.completed?1:0,p.bestScore,stamp);
            db.exec('COMMIT');
          } catch(e) {db.exec('ROLLBACK');throw e;}
          return json(res,200,{progress:getProgress(user.id)});
        }
        fail(404,'NOT_FOUND');
      }
      if(!['GET','HEAD'].includes(req.method)) fail(405,'METHOD_NOT_ALLOWED');
      const decoded=decodeURIComponent(pathname);
      const target=path.resolve(staticRoot,'.'+decoded);
      if(!target.startsWith(path.resolve(staticRoot)+path.sep)&&target!==path.resolve(staticRoot)) fail(403,'FORBIDDEN');
      const file=existsSync(target)&&statSync(target).isFile()?target:!path.extname(decoded)?path.join(staticRoot,'index.html'):null;
      if(!file||!existsSync(file)) fail(404,'NOT_FOUND');
      const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ttf':'font/ttf','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
      const size=statSync(file).size;
      const headers={'Content-Type':mime,'Cache-Control':file.endsWith('index.html')||file.endsWith('sw.js')?'no-cache':'public, max-age=3600','Accept-Ranges':'bytes'};
      if(req.headers.range){
        const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        const start=match?Number(match[1]):-1,end=match&&match[2]?Math.min(Number(match[2]),size-1):size-1;
        if(start<0||start>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
        res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`});
        if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);
      } else {res.writeHead(200,{...headers,'Content-Length':size});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}
    } catch(e) { if(!res.headersSent) json(res,e.status||500,{error:e.status?e.message:'SERVER_ERROR'}); else res.end(); }
  });
  server.on('close',()=>db.close());
  return server;
}
if(process.argv[1]&&realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))) {
  const port=Number(process.env.PORT||8787), host=process.env.HOST||'127.0.0.1';
  createServer().listen(port,host,()=>console.log(`Sana: http://${host}:${port}`));
}
