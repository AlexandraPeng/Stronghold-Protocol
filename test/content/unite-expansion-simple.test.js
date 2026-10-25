import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeBattle,chessRec} from '../helpers/battleHarness.js';
import * as enemies from '../../server/sim/content/enemies.js';
import {UNITE_SIMPLE_KITS} from '../../server/sim/content/enemies/uniteExpansion/simple.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../../data/workshop-enemies.json',import.meta.url))).enemies;
const defs=Object.fromEntries(Object.keys(UNITE_SIMPLE_KITS).map(k=>[k,catalog[k].levels[0]]));
const expansion={install(b){enemies.ensureInstalled(b, {...enemies.KITS,...UNITE_SIMPLE_KITS});}};
function arena(){const h=makeBattle({content:'generic',extraContent:[expansion],autoFinish:false,timeLimit:200,
  defs:{enemies:defs,chess:{wall:chessRec({id:'wall',stats:{atk:0,maxHp:1e7,def:500,blockCnt:5},skill:null})}},
  kits:{wall:()=>({trait:{noAttack:true}})},units:[{chessId:'wall',row:9,col:5}],captureNoisy:true});h.step();return h;}
function put(h,key,pos=[9,8]){const e=h.spawn(key,{pos,routeIndex:0,mods:{speedMul:0}});h.b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true}});return e;}

test('unite expansion kits are registered once for every new enemy',()=>{
  for(const key of Object.keys(UNITE_SIMPLE_KITS))assert.equal(enemies.KITS[key],UNITE_SIMPLE_KITS[key],key);
});
test('wasteland: each attack reduces DEF by 50, persists, caps at 999 layers',()=>{
  const h=arena(),e=put(h,'enemy_2151_shwolf'),u=h.unit('wall');
  for(let i=0;i<3;i++)h.b.dealDamage(e,u,{amount:1,type:'true',isAttack:true});
  assert.equal(u.s.def,350);h.run(1);assert.equal(u.s.def,350);assert.equal(h.b.errorCount,0);
  for(let i=0;i<1000;i++)h.b.dealDamage(e,u,{amount:1,type:'true',isAttack:true});
  assert.equal(u.findBuff('ux:wastelandDef').stacks,999);
});
test('frost pair: leaking a partner grants one rage, and its cold arrives after 0.1s',()=>{
  const h=arena(),snow=put(h,'enemy_2014_csicer',[9,8]),frost=put(h,'enemy_2015_csicem',[9,9]),u=h.unit('wall');
  const aspd=snow.s.aspd;h.b.leak(frost);assert.equal(snow.s.aspd,aspd+100);
  h.b.dealDamage(snow,u,{amount:1,type:'phys',isAttack:true});assert.equal(u.s.flags.cold,undefined);
  h.run(.12);assert.ok(u.s.flags.cold);assert.equal(h.b.errorCount,0);
});
test('dream: ordinary attack resolves five separate hits without recursive duplication',()=>{
  const h=arena(),e=put(h,'enemy_10110_mjcsdw_2',[9,8]),u=h.unit('wall');
  h.b.emit('attack',{attacker:e,targets:[u],isSkill:false});
  assert.equal(h.hooksOf('damaged').filter(c=>c.source===e&&c.target===u).length,5);
  assert.equal(e.def.staticBody,true);assert.equal(h.b.errorCount,0);
});
test('runners: ramp to +1.5 speed and slow only under theatre status',()=>{
  const h=arena(),e=put(h,'enemy_10158_mnzeno');h.run(20);
  assert.ok(Math.abs(e.findBuff('ux:runner').mods.moveFlat-1.5)<1e-9);
  assert.equal(e.profile.noAttack,true);assert.equal(e.s.flags.unblockable,true);
  h.b.addBuff(e,{key:'test:theatre',flags:{theatreEnemy:true},persist:true});
  // Spawn pinned for the ramp test; unpin for the slow-condition check.
  e.base.moveSpeed=2;e.markDirty();h.run(1.1);
  assert.ok(e.findBuff('ux:runner').mods.moveFlat<1.5);assert.equal(h.b.errorCount,0);
});
test('all isolated simple kits run real simulation ticks without handler errors',()=>{
  for(const key of Object.keys(UNITE_SIMPLE_KITS)){
    const h=arena();put(h,key,[9,8]);h.run(22);assert.equal(h.b.errorCount,0,key);
  }
});
