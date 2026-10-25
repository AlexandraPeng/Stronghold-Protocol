import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_TALISMAN_KITS, sealTarget, isSealed } from '../../server/sim/content/enemies/uniteExpansion/talismans.js';
const PAPER='enemy_2101_dyspll',SEAL='enemy_2121_dyspl2';
const arena=()=>expansionArena(UNITE_TALISMAN_KITS);

test('paper hit count stays twelve under ultimate-round HP scaling',()=>{
  const h=arena(),e=pinEnemy(h,PAPER,[9,8],{hpMul:20}),u=h.unit('wall');
  assert.equal(e.s.maxHp,12);
  for(let i=0;i<11;i++)h.b.dealDamage(u,e,{amount:99999,type:'phys'});
  assert.equal(e.hp,1);assert.ok(e.alive);
  h.b.dealDamage(u,e,{amount:99999,type:'phys'});assert.equal(e.alive,false);
});
test('paper attaches with its HP ratio, seals and deals periodic arts damage; destroying it clears seal',()=>{
  const h=arena(),e=pinEnemy(h,PAPER),u=h.unit('wall');e.hp=6;
  h.b.dealDamage(e,u,{amount:1,type:'phys',isAttack:true});h.step();
  const seal=h.b.enemies.find(o=>o.alive&&o.defId===SEAL);assert.ok(seal);assert.equal(seal.hp,6);assert.equal(e.alive,false);
  assert.ok(isSealed(u));assert.ok(u.s.flags.silence);const hp=u.hp;h.run(1.1);assert.ok(u.hp<hp);
  for(let i=0;i<6;i++)h.b.dealDamage(u,seal,{amount:10000,type:'phys'});
  assert.equal(seal.alive,false);assert.equal(isSealed(u),false);assert.equal(h.b.errorCount,0);
});
test('attachment ends when the host leaves its one-tile square; no stray seal remains',()=>{
  const h=arena(),e=pinEnemy(h,PAPER),u=h.unit('wall'),seal=sealTarget(h.b,e,u);h.step();assert.ok(isSealed(u));
  u.x+=1;h.step();assert.equal(seal.alive,false);assert.equal(isSealed(u),false);assert.equal(u.mem.uniteAttachedPaper,undefined);
});
test('swordsman delays attachment by 1.01 seconds and cannot attach to a different deployment',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2103_dykens'),u=h.unit('wall');
  h.b.dealDamage(e,u,{amount:1,type:'phys',isAttack:true});h.run(.9);assert.equal(isSealed(u),false);h.run(.2);
  assert.ok(isSealed(u));assert.equal(e.mem.uniteTalismanAmmo,2);
  const seal=h.b.enemies.find(o=>o.alive&&o.defId===SEAL);h.b.kill(seal);
  h.b.dealDamage(e,u,{amount:1,type:'phys',isAttack:true});u.deploySeq++;h.run(1.1);
  assert.equal(isSealed(u),false);assert.equal(e.mem.uniteTalismanAmmo,2);assert.equal(h.b.errorCount,0);
});
test('scholar absorbs a nearby flying paper at 40% HP, heals 60%, and can only do so once',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2102_dytmbr'),paper=pinEnemy(h,PAPER);e.hp=e.s.maxHp*.4;
  h.step();assert.equal(paper.alive,false);assert.equal(e.hp,e.s.maxHp);
  const other=pinEnemy(h,PAPER);e.hp=e.s.maxHp*.2;h.step();assert.ok(other.alive);assert.equal(e.hp,e.s.maxHp*.2);
});
test('master uses its global skill after 20 seconds and sends a hasted paper toward the chosen tile',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2104_dycast');h.run(20.2);
  const paper=h.b.enemies.find(o=>o.alive&&o.defId===PAPER);assert.ok(paper);assert.ok(paper.findBuff('ux:paperHaste'));
  assert.equal(e.profile.noAttack,true);assert.equal(h.b.errorCount,0);
});
