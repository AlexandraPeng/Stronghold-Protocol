import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_FLY_KITS, buoyancyAt } from '../../server/sim/content/enemies/uniteExpansion/flying.js';
const KITS={...UNITE_FLY_KITS,enemy_2102_dytmbr:()=>[],enemy_10119_ymgbxm:()=>[],enemy_2114_dylbgg:()=>[]};
const arena=opts=>expansionArena(KITS,opts);
test('letter: five qualifying physical/element hits move it to the attacker, take no HP and grant one second invulnerability',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10231_agpack'),u=h.unit('wall'),hp=e.hp;
  for(let i=0;i<4;i++)h.b.dealDamage(u,e,{amount:100,type:'phys'});assert.equal(e.x,8);assert.equal(e.hp,hp);
  h.b.dealDamage(u,e,{amount:100,type:'element',element:'burn'});assert.equal(e.x,5);assert.equal(e.y,9);assert.ok(e.s.flags.invulnerable);
  h.run(1.1);h.b.dealDamage(u,e,{amount:100,type:'phys'});assert.equal(e.mem.uniteLetterSp,0);assert.equal(e.hp,hp);assert.equal(h.b.errorCount,0);
});
test('courier: steals a letter once and drops a stationary replacement on death, but not on leak',()=>{
  for(const leak of [false,true]){
    const h=arena(),e=pinEnemy(h,'enemy_10224_agmess'),letter=pinEnemy(h,'enemy_10231_agpack');h.step();
    assert.equal(letter.alive,false);assert.equal(e.form,'carrying');if(leak)h.b.leak(e);else h.b.kill(e);
    assert.equal(h.b.enemies.filter(o=>o.alive&&o.defId==='enemy_10231_agpack').length,leak?0:1);assert.equal(h.b.errorCount,0);
  }
});
test('bus: carries at most two ground non-mechanical non-boss passengers and unloads them with its remaining path',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10225_agpbus'),a=pinEnemy(h,'enemy_2102_dytmbr'),b=pinEnemy(h,'enemy_2102_dytmbr');
  const machine=pinEnemy(h,'enemy_10119_ymgbxm'),boss=pinEnemy(h,'enemy_2114_dylbgg');h.step();
  assert.ok(a.hidden&&b.hidden);assert.equal(machine.hidden,false);assert.equal(boss.hidden,false);
  h.b.kill(e);assert.equal(a.hidden,false);assert.equal(b.hidden,false);assert.equal(a.mem.uniteCarrier,undefined);
  assert.ok(Math.abs(a.x-e.x)<=.2&&Math.abs(a.y-e.y)<=.2);assert.equal(h.b.errorCount,0);
});
test('propeller: its aura hits both sides, ignores target selection, does not stack, and silence suspends it',()=>{
  const h=arena(),u=h.unit('wall'),e=pinEnemy(h,'enemy_10150_nsheat',[9,6]);pinEnemy(h,'enemy_10150_nsheat',[9,6]);
  const target=pinEnemy(h,'enemy_2102_dytmbr',[9,6]);h.run(1.1);assert.equal(u.elem.burn,36);assert.equal(target.elem.burn,36);
  assert.equal(buoyancyAt(h.b,9,6),2);for(const p of h.b.enemies.filter(o=>o.defId===e.defId))h.b.applyStatus(p,'silence',{duration:5});
  h.run(1.1);assert.equal(u.elem.burn,36);assert.equal(h.b.errorCount,0);
});
test('toilet: first KO on passable ground leaves a full-HP nonprimary wreck with double DEF and negative buoyancy',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10151_nspace');const def=e.s.def;h.b.kill(e);
  assert.ok(e.alive);assert.equal(e.hp,e.s.maxHp);assert.equal(e.motion,'WALK');assert.equal(e.s.def,def*2);
  assert.ok(e.mem.nonPrimary);assert.equal(buoyancyAt(h.b,9,8),-1);assert.equal(h.b.errorCount,0);
});
