import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_CAPTURE_KITS } from '../../server/sim/content/enemies/uniteExpansion/capture.js';
import { UNITE_COMBAT_LEADER_KITS } from '../../server/sim/content/enemies/uniteExpansion/combatLeaders.js';
const KITS={...UNITE_CAPTURE_KITS,...UNITE_COMBAT_LEADER_KITS};
const arena=()=>expansionArena(KITS);
test('devourer: locks a forced knock-out against every redeploy, hovers, and frees the operator on death',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2105_dyrnge',[9,5]),u=h.unit('wall');e.blockedBy=u;h.step();
  assert.equal(u.alive,false);assert.equal(u.mem.uniteCapture,e);assert.equal(h.b.redeploy(u),false);assert.ok(e.s.flags.float);assert.equal(e.s.def,0);
  h.run(1);assert.equal(u.alive,false);h.b.kill(e);assert.equal(u.mem.uniteCapture,undefined);assert.ok(u.alive);assert.equal(h.b.errorCount,0);
});
test('companion: carries a stunned operator for 3 seconds, restores it and enforces a 10-second pickup cooldown',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10107_mjcdog_2',[9,5]),u=h.unit('wall');u.hp=u.s.maxHp*.4;
  h.b.applyStatus(u,'stun',{duration:10});h.step();assert.equal(u.alive,false);assert.equal(e.lpr,1);assert.equal(e.blockWeight,6);
  h.run(3.1);assert.ok(u.alive);assert.equal(u.hp,u.s.maxHp*.4);assert.ok(u.s.flags.stun);assert.equal(e.lpr,0);
  h.run(2);assert.ok(u.alive);assert.equal(h.b.errorCount,0);
});
test('war shield: blocks hits below 1200 after mitigation; a threshold hit breaks it, leakage restores it',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10210_muwiz'),u=h.unit('wall'),hp=e.hp;
  assert.equal(e.s.def,1080);assert.equal(e.s.res,20);
  h.b.dealDamage(u,e,{amount:2000,type:'phys',canDodge:false});assert.equal(e.hp,hp);
  h.b.dealDamage(u,e,{amount:2280,type:'phys',canDodge:false});assert.ok(e.hp<hp);assert.equal(e.s.def,900);
  h.b.addBuff(e,{key:'test:leakSource',persist:true,flags:{leakSource:true}});h.step();assert.equal(e.s.def,1080);assert.equal(h.b.errorCount,0);
});
test('cold disaster: frozen retreat doubles the current redeploy time, including two simultaneous sources',()=>{
  const h=arena(),u=h.unit('wall');pinEnemy(h,'enemy_2007_flwitch');pinEnemy(h,'enemy_2007_flwitch');
  h.b.applyStatus(u,'freeze',{duration:5});const base=u.base.respawnTime;h.b.retreat(u);
  assert.equal(u.respawnAt-h.b.time,base*4);assert.equal(h.b.errorCount,0);
});
test('sniper: shoots at 5 seconds, respects post-shot reload lock and finishes uninterrupted 10-second reload',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10088_hlsnip_2');h.run(5.5);
  assert.equal(h.hooksOf('damaged').filter(c=>c.source===e).length,1);h.run(19.5);
  assert.equal(h.hooksOf('damaged').filter(c=>c.source===e).length,1);h.run(2);
  assert.equal(h.hooksOf('damaged').filter(c=>c.source===e).length,2);assert.equal(h.b.errorCount,0);
});
test('all isolated combat leaders can tick long enough to reach their skill cooldowns without handler exceptions',()=>{
  for(const key of Object.keys(UNITE_COMBAT_LEADER_KITS)){const h=arena();pinEnemy(h,key,[9,6]);h.run(90);assert.equal(h.b.errorCount,0,key);}
});
