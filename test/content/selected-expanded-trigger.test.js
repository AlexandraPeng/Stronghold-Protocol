import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeBattle,enemyRec} from '../helpers/battleHarness.js';
import {absoluteRangeKeys} from '../../server/sim/targeting.js';
const cases=[["1_19", 1], ["3_02", 1], ["4_02", 2], ["4_09", 2], ["4_22", 2], ["4_23", 1], ["5_01", 0], ["5_01", 2], ["5_12", 1], ["5_12", 2], ["5_14", 2], ["5_18", 1], ["5_21", 1], ["5_22", 2], ["6_06", 1], ["6_07", 1], ["6_09", 2], ["6_10", 2], ["6_15", 2], ["6_17", 0], ["6_17", 2],['1_08',1],['3_18',1],['3_18',2],['4_12',1],['4_14',1],['5_06',2],['5_10',2],['5_20',2],['6_18',1]];
for(const [id,index] of cases)for(const suffix of ['a','b'])for(const dir of ['RIGHT','UP','LEFT','DOWN'])test(`${id}_${suffix} skill ${index+1} ${dir}: extended range casts, outside/low SP/cooldown do not`,()=>{
 const h=makeBattle({kind:'unite',rect:{r0:0,r1:18,c0:0,c1:20},autoFinish:false,defs:{enemies:{dummy:enemyRec({key:'dummy',hp:1e9,speed:0})}},units:[{chessId:`chess_char_${id}_${suffix}`,skillIndex:index,row:10,col:10,dir}],hooks:['skillStart']});
 h.b.start();const u=h.b.allyUnits[0],s=u.skill;
 assert.equal(s.rule,'EXPANDED_SKILL_RANGE');
 const tg=s.spec.targeting||{};
 const keys=absoluteRangeKeys(tg.rangeGrid||s.def.rangeGrid||u.rangeGrid,u.tileR,u.tileC,u.dir,u.s.rangeExtend+(tg.rangeExtend||0));
 const base=new Set(u.baseRangeKeys);const key=keys.find(k=>!base.has(k));assert.notEqual(key,undefined);
 s.setSpTotal(s.spCost);s.tick(0);assert.equal(s.activations,0,'no enemy');
 const far=h.spawn('dummy',{pos:[1,1]});s.tick(0);assert.equal(s.activations,0,'outside skill range');h.b.kill(far);
 h.spawn('dummy',{pos:[Math.floor(key/21),key%21]});
 h.b._buildEnemyIndex();s.setSpTotal(0);s.tick(0);assert.equal(s.activations,0,'low SP');
 s.setSpTotal(s.spCost);if(s.manual){s.opReadyAt=h.b.time+3;s.tick(0);assert.equal(s.activations,0,'cooldown');}
 s.opReadyAt=-Infinity;s.tick(0);assert.equal(s.activations,1,'enemy only in expanded area');
 assert.deepEqual(h.b.errors,[]);
});
test('all other real operator skills retain their prior trigger rules',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../../data/chess.json',import.meta.url)));
 const chosen=new Set(cases.map(([id,i])=>`${id}:${i}`));
 for(const [id,rec] of Object.entries(data)){
  if(!id.endsWith('_a'))continue;
  for(const sk of rec.skills||[]){
   const h=makeBattle({units:[{chessId:id,skillIndex:sk.index,row:10,col:4}]});
   const s=h.b.allyUnits[0].skill;
   if(!chosen.has(`${id.replace('chess_char_','').replace(/_a$/,'')}:${sk.index}`))assert.notEqual(s.rule,'EXPANDED_SKILL_RANGE',`${id}/${sk.index}`);
  }
 }
});
