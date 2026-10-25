import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITE_TUNING } from '../../shared/uniteTuning.js';
import { BASE_RELICS, editableRelicParams, tunedRelics, relicWeight } from '../../shared/relicTuning.js';
import { validateUniteTuning } from '../../shared/uniteTuningSchema.js';
import { collectibleDropCount } from '../../server/match/uniteExpansion.js';
import { settleRelics } from '../../server/match/blackforest.js';
import { makeMatch, DATA } from './harness.js';
const check=c=>validateUniteTuning(c,DATA.enemies,DATA.waves,DATA.choices);
test('relic export validates effects, bounded adapter numbers, weights and legacy documents',()=>{
 assert.deepEqual(check(UNITE_TUNING),UNITE_TUNING);
 const r=BASE_RELICS.find(r=>editableRelicParams(r).some(p=>p.param==='count'));
 const p=editableRelicParams(r).find(p=>p.param==='count');
 const c={...structuredClone(UNITE_TUNING),relicDrops:[0,1,2,3,2,1],relics:{[r.id]:{weight:9,params:{[p.path]:8}},rogue_6_relic_assign_1:{adapter:{atkPerCast:0.3,maxCasts:4}}}};
 assert.deepEqual(check(JSON.parse(JSON.stringify(c))),c);
 assert.equal(tunedRelics(c).find(x=>x.id===r.id).buffs[Number(p.path.split('.')[0])].params.count,8);
 assert.equal(tunedRelics(c).find(x=>x.id==='rogue_6_relic_assign_1').adapter.atkPerCast,0.3);
 for(const mutate of [x=>x.relics.unknown={},x=>x.relics[r.id].weight=-1,x=>x.relics[r.id].params.evil=1,x=>x.relics[r.id].params[p.path]=0.5,x=>x.relics.rogue_6_relic_assign_1.adapter.maxCasts=2.5,x=>x.relicDrops[0]=4,x=>x.relics=Object.fromEntries(BASE_RELICS.map(r=>[r.id,{weight:0}]))]){const x=structuredClone(c);mutate(x);assert.throws(()=>check(x));}
});
test('changed weights control real server receipts and per-tier counts retain mode isolation',()=>{
 const old=UNITE_TUNING.relics,counts=UNITE_TUNING.relicDrops;
 const h=makeMatch({mode:'coop',uniteStacking:true,humans:2,fake:true}).start();
 try{
  h.toPrep(1);const ps=h.m.alivePlayers()[0],only=BASE_RELICS[2];
  UNITE_TUNING.relics=Object.fromEntries(BASE_RELICS.map(r=>[r.id,{weight:r===only?1:0}]));UNITE_TUNING.relicDrops=[0,2,3,1,2,3];
  assert.equal(collectibleDropCount(0),0);assert.equal(collectibleDropCount(1),2);
  ps.hand=Array.from({length:20},(_,i)=>({kind:'item',id:'full',uid:i+90000,items:[]}));
  settleRelics(h.m,ps,{relicKills:[{id:'edited',count:3}]});
  assert.deepEqual(ps.relicQueue,Array(3).fill(`blackforest_${only.id}`));
  settleRelics(h.m,ps,{relicKills:[{id:'edited',count:3}]});assert.equal(ps.relicQueue.length,3);
  assert.equal(relicWeight(only.id,UNITE_TUNING),1);
  h.m.uniteStacking=false;settleRelics(h.m,ps,{relicKills:[{id:'ordinary',count:3}]});assert.equal(ps.relicQueue.length,3);
 }finally{if(old===undefined)delete UNITE_TUNING.relics;else UNITE_TUNING.relics=old;if(counts===undefined)delete UNITE_TUNING.relicDrops;else UNITE_TUNING.relicDrops=counts;h.m.dispose();}
});
