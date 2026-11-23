import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server/server.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('accounts, isolation, two devices, monotonic sync, deletion and validation',async()=>{
 const server=createServer({database:':memory:',rateLimit:100});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/api`;
 const call=async(route,method='GET',data,token)=>{const r=await fetch(url+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,...await r.json()};};
 try {
  const a=await call('/auth/register','POST',{username:'learner',nickname:'Learner',password:'a-long-test-password'});assert.equal(a.status,201);
  assert.equal((await call('/auth/register','POST',{username:'learner',nickname:'Other',password:'a-long-test-password'})).status,409);
  assert.equal((await call('/auth/login','POST',{username:'learner',password:'wrong-password'})).status,401);
  const b=await call('/auth/login','POST',{username:'learner',password:'a-long-test-password'});assert.equal(b.user.id,a.user.id);assert.notEqual(b.token,a.token);
  const c=await call('/auth/register','POST',{username:'other',nickname:'Other',password:'other-test-password'});
  const row=(id,score,completed=true)=>({lessonId:id,bestScore:score,completed,updatedAt:new Date().toISOString()});
  assert.equal((await call('/progress')).status,401);
  await call('/progress','PUT',{progress:{'g1-01':row('g1-01',100)}},a.token);
  await call('/progress','PUT',{progress:{'g2-01':row('g2-01',80)}},b.token);
  let p=(await call('/progress','GET',null,a.token)).progress;assert.equal(Object.keys(p).length,2);
  p=(await call('/progress','PUT',{progress:{'g1-01':row('g1-01',0,false)}},b.token)).progress;assert.equal(p['g1-01'].bestScore,100);assert.equal(p['g1-01'].completed,true);
  assert.deepEqual((await call('/progress','GET',null,c.token)).progress,{});
  assert.equal((await call('/progress','PUT',{progress:{'g4-99':row('g4-99',100)}},a.token)).status,400);
  assert.equal((await call('/progress','PUT',{progress:{'g1-01':row('g1-01',101)}},a.token)).status,400);
  assert.equal((await call('/me','DELETE',{password:'wrong-password'},a.token)).status,401);
  assert.equal((await call('/me','DELETE',{password:'a-long-test-password'},a.token)).status,200);
  assert.equal((await call('/me','GET',null,b.token)).status,401);
 } finally {await new Promise(r=>server.close(r));}
});
test('authentication throttling',async()=>{
 const server=createServer({database:':memory:',rateLimit:1});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const url=`http://127.0.0.1:${server.address().port}/api/auth/login`;const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'missing',password:'password-test'})};await fetch(url,options);assert.equal((await fetch(url,options)).status,429);} finally {await new Promise(r=>server.close(r));}
});
test('audio byte ranges support browser media playback',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'sana-range-'));writeFileSync(path.join(root,'tone.mp3'),'0123456789');
 const server=createServer({database:':memory:',staticRoot:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const url=`http://127.0.0.1:${server.address().port}/tone.mp3`;let r=await fetch(url,{headers:{Range:'bytes=2-4'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-4/10');assert.equal(await r.text(),'234');r=await fetch(url,{headers:{Range:'bytes=20-'}});assert.equal(r.status,416);r=await fetch(url);assert.equal(await r.text(),'0123456789');}
 finally{await new Promise(r=>server.close(r));rmSync(root,{recursive:true});}
});
