import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DATA } from './harness.js';
import { GameData } from '../../server/match/gamedata.js';
import { UNITE_TUNING } from '../../shared/uniteTuning.js';
import { validateUniteTuning } from '../../shared/uniteTuningSchema.js';
import { buildNormalWave } from '../../server/match/waves.js';
import { createRng } from '../../server/sim/rng.js';
import { roundBountyPool, drawRoundBountyCards } from '../../server/match/uniteExpansion.js';
const check = c => validateUniteTuning(c,DATA.enemies,DATA.waves,DATA.choices);
test('editor round trip preserves the live configuration and rejects malformed or protected edits',()=>{
 assert.deepEqual(check(JSON.parse(JSON.stringify(UNITE_TUNING))),UNITE_TUNING);
 for(const edit of [c=>c.probabilities[0][0]=31,c=>c.probabilities[0]=[30,30,30,10,0,0],c=>c.groups[0].keys=['missing'],c=>c.bounties[0].coins=6,c=>c.minRound.enemy_10156_mncrer=NaN,c=>c.groups[0].halves=['invalid'],c=>c.templates.act1autochess_01={'0':{enemyKey:'evil'}},c=>c.templates.act1autochess_01={'0':{count:0}},c=>c.templates.missing={'0':{count:2}}]){
  const c=structuredClone(UNITE_TUNING);edit(c);assert.throws(()=>check(c));
 }
 const [id,w]=Object.entries(DATA.waves).find(([,w])=>w.spawns.some(s=>s.tag==='boss'));
 const c=structuredClone(UNITE_TUNING);c.templates[id]={[w.spawns.findIndex(s=>s.tag==='boss')]:{count:3}};assert.throws(()=>check(c));
});
test('custom template edits affect the real generator while ordinary games and official source stay unchanged',()=>{
 const custom=new GameData(DATA,'mode_multi_abyss');custom.uniteExpansion=true;
 const ordinary=new GameData(DATA,'mode_multi_abyss');
 const build=gd=>buildNormalWave(gd,createRng(3),{},1);
 const source=JSON.stringify(DATA.waves),before=build(ordinary),base=build(custom);
 try{
  UNITE_TUNING.templates[base.templateId]={'0':{count:1,time:22,interval:1}};
  const edited=build(custom);
  assert.equal(edited.actions[0].time,22);assert.equal(edited.actions[0].tplCount,1);
  assert.deepEqual(build(ordinary),before);assert.equal(JSON.stringify(DATA.waves),source);
 }finally{delete UNITE_TUNING.templates[base.templateId];}
});
test('edited base bounties change rewards without losing zero-tier enemies; zero-weight tiers are never drawn',()=>{
 const gd=new GameData(DATA,'mode_multi_abyss');gd.uniteExpansion=true;
 const original=roundBountyPool(gd,1).find(c=>c.coin===1),saved=UNITE_TUNING.probabilities[0];
 try{
  UNITE_TUNING.baseCoins[original.enemyKey]=2;
  assert.ok(roundBountyPool(gd,1).some(c=>c.enemyKey===original.enemyKey&&c.coin===2));
  assert.ok(roundBountyPool(gd,1).some(c=>c.enemyKey===original.enemyKey&&c.coin===0));
  UNITE_TUNING.probabilities[0]=[100,0,0,0,0,0];
  assert.ok(drawRoundBountyCards(gd,createRng(2),1).every(c=>c.coin===0));
 }finally{delete UNITE_TUNING.baseCoins[original.enemyKey];UNITE_TUNING.probabilities[0]=saved;}
});
test('apply command validates before writing, preserves official data and creates an exact backup',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stronghold-tuning-'));
 try {
  for(const rel of ['tools/apply-unite-tuning.mjs','shared/uniteTuningSchema.js','shared/relicTuning.js','shared/blackforestSource.js','shared/uniteTuning.js','data/enemies.json','data/waves.json','data/choices.json','data/stages.json']) {
   const target=path.join(dir,rel);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(new URL(`../../${rel}`,import.meta.url),target);
  }
  await fs.writeFile(path.join(dir,'package.json'),'{"type":"module"}');
  const before=await fs.readFile(path.join(dir,'shared/uniteTuning.js'),'utf8');
  const source=await fs.readFile(path.join(dir,'data/waves.json'),'utf8');
  const doc=structuredClone(UNITE_TUNING);doc.probabilities[0]=[35,35,30,0,0,0];
  const file=path.join(dir,'export.json');await fs.writeFile(file,JSON.stringify(doc));
  const run=(...args)=>spawnSync(process.execPath,[path.join(dir,'tools/apply-unite-tuning.mjs'),file,...args],{encoding:'utf8'});
  assert.equal(run().status,0);assert.equal(await fs.readFile(path.join(dir,'shared/uniteTuning.js'),'utf8'),before);
  const applied=run('--write');assert.equal(applied.status,0,applied.stderr);
  const backups=(await fs.readdir(path.join(dir,'shared'))).filter(p=>p.endsWith('.bak'));assert.equal(backups.length,1);
  assert.equal(await fs.readFile(path.join(dir,'shared',backups[0]),'utf8'),before);
  assert.equal(await fs.readFile(path.join(dir,'data/waves.json'),'utf8'),source);
  const after=await fs.readFile(path.join(dir,'shared/uniteTuning.js'),'utf8');assert.notEqual(after,before);
  doc.probabilities[0][0]=900;await fs.writeFile(file,JSON.stringify(doc));assert.notEqual(run('--write').status,0);
  assert.equal(await fs.readFile(path.join(dir,'shared/uniteTuning.js'),'utf8'),after);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('stronghold-tuning-'));await fs.rm(dir,{recursive:true,force:true});}
});
