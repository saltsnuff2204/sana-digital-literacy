const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {lessons,mergeProgress,moveRobot}=require('../scripts/export-content.cjs');
test('all 69 lessons have RU/KK cards, distinct answers and valid activities',()=>{
 assert.deepEqual([1,2,3,4].map(g=>lessons.filter(l=>l.grade===g).length),[10,17,20,22]);
 assert.equal(new Set(lessons.map(l=>l.id)).size,69);
 for(const l of lessons){
  for(const lang of ['ru','kk']){
   assert.ok(l.title[lang].length>3,l.id);assert.ok(l.unit[lang]);
   assert.equal(l.cards.length,2);for(const c of l.cards)assert.ok(c.text[lang].length>50,l.id);
   assert.equal(new Set(l.check.options.map(o=>o[lang])).size,3,l.id);
   assert.ok(l.check.options[l.check.answer][lang]);
  }
  const a=l.activity;if(a.kind==='order')assert.ok(a.items.length>=3);
  if(a.kind==='pairs')assert.ok(a.pairs.length>=3);
  if(a.kind==='robot'){
   const visited=new Set([a.start]),q=[a.start];while(q.length){const p=q.shift();for(const d of ['↑','→','↓','←']){const n=moveRobot(p,d,a.size,a.walls);if(!visited.has(n)){visited.add(n);q.push(n);}}}assert.ok(visited.has(a.target),'robot maze must be solvable');
  }
 }
});
test('progress merge is commutative, idempotent and never loses offline completion',()=>{
 const a={'g1-01':{lessonId:'g1-01',completed:true,bestScore:90,updatedAt:'2026-11-22T00:00:00Z'}};
 const b={'g1-01':{lessonId:'g1-01',completed:false,bestScore:50,updatedAt:'2026-11-23T00:00:00Z'},'g2-01':{lessonId:'g2-01',completed:true,bestScore:100,updatedAt:'2026-11-23T00:00:00Z'}};
 assert.deepEqual(mergeProgress(a,b),mergeProgress(b,a));assert.deepEqual(mergeProgress(a,a),a);
 assert.equal(mergeProgress(a,b)['g1-01'].completed,true);assert.equal(mergeProgress(a,b)['g1-01'].bestScore,90);
});
test('robot cannot cross boundaries or walls',()=>{assert.equal(moveRobot(3,'→',4,[]),3);assert.equal(moveRobot(0,'↑',4,[]),0);assert.equal(moveRobot(4,'→',4,[5]),4);assert.equal(moveRobot(12,'↑',4,[]),8);});
test('all bundled narrations exist and have nonempty audio',()=>{
 const manifest=fs.readFileSync(path.join(__dirname,'../src/audio.ts'),'utf8');
 for(const l of lessons)for(const lang of ['ru','kk']){const name=`${l.id}-${lang}.mp3`;assert.ok(manifest.includes(name),name);assert.ok(fs.statSync(path.join(__dirname,'../assets/audio',name)).size>1000,name);}
});
