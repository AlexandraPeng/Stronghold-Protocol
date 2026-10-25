import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_MOON_KITS } from '../../server/sim/content/enemies/uniteExpansion/moons.js';
import { UNITE_WRITER_KITS } from '../../server/sim/content/enemies/uniteExpansion/writer.js';
import { UNITE_HANKO_KITS } from '../../server/sim/content/enemies/uniteExpansion/hanko.js';
import { UNITE_LAMALIEN_KITS } from '../../server/sim/content/enemies/uniteExpansion/lamalien.js';
import { UNITE_TALISMAN_KITS } from '../../server/sim/content/enemies/uniteExpansion/talismans.js';
const KITS = {...UNITE_MOON_KITS,...UNITE_WRITER_KITS,...UNITE_HANKO_KITS,...UNITE_LAMALIEN_KITS,...UNITE_TALISMAN_KITS};
test('Xi e: initial dodge, control grounds her, full-HP paper is preserved when returning to hover', () => {
  const h = expansionArena(KITS), e = pinEnemy(h,'enemy_2108_dypryg');
  assert.ok(e.s.flags.float); assert.equal(e.s.dodgePhys,.5);
  h.b.applyStatus(e,'stun',{duration:1}); assert.ok(!e.s.flags.float);
  const p = pinEnemy(h,'enemy_2101_dyspll',[9,8]); h.run(1.1);
  assert.ok(e.s.flags.float); assert.ok(p.alive); e.hp -= 1000; h.step(); assert.ok(!p.alive); assert.equal(e.hp,e.s.maxHp);
  assert.equal(h.b.errorCount,0);
});
test('twin moon: consumes paper, doubles range and refreshes a single haste effect; control returns to ground', () => {
  const h = expansionArena(KITS), e = pinEnemy(h,'enemy_2109_dypry2');
  assert.ok(!e.s.flags.float); pinEnemy(h,'enemy_2101_dyspll',[9,8]); h.step();
  assert.ok(e.s.flags.float); assert.equal(e.profile.rangeRadius,e.base.rangeRadius*2); assert.equal(e.s.aspd,150);
  pinEnemy(h,'enemy_2101_dyspll',[9,8]); h.step(); assert.equal(e.s.aspd,150);
  h.b.applyStatus(e,'freeze',{duration:2}); assert.ok(!e.s.flags.float); assert.equal(e.profile.rangeRadius,e.base.rangeRadius);
});
test('writer: permanent gaze survives its caster, ticks 4% arts damage, extends redeploy and seals all placement paths', () => {
  const h = expansionArena(KITS), e = pinEnemy(h,'enemy_2020_cswrtr'), u=h.unit('wall');
  h.run(20.1); assert.equal(u.s.aspd,50); assert.ok(u.findBuff('ux:writerGaze'));
  h.b.kill(e); const hp=u.hp; h.run(1); assert.equal(hp-u.hp,u.s.maxHp*.04);
  const respawn=u.base.respawnTime; h.b.retreat(u); assert.equal(u.respawnAt-h.b.time,respawn*1.5);
  assert.ok(h.b.isReservedTile(9,5)); assert.equal(h.b.redeploy(u),false);
  const dp=h.b.getPlayer(u.ownerId).dp; h.b._checkRedeploys(); assert.equal(h.b.getPlayer(u.ownerId).dp,dp);
  assert.equal(h.b.errorCount,0);
});
test('smoke: starts at 0.75s, flare suppression removes concealment, Hanko departure removes every smoke', () => {
  const h=expansionArena(KITS), s=pinEnemy(h,'enemy_2156_shsmok',[9,5]), u=h.unit('wall');
  h.run(.5); assert.ok(!u.s.flags.stealth); h.run(.3); assert.ok(u.s.flags.stealth);
  s.mem.uniteSmokeDisabledUntil=h.b.time+15; h.step(); assert.ok(!u.s.flags.stealth);
  const e=pinEnemy(h,'enemy_2139_shdbj2'); h.b.kill(e); assert.ok(!s.alive); assert.equal(h.b.errorCount,0);
});
test('Lamaliens delayed thorn applies one x-2 imprint and does not turn conception loot into money', () => {
  const h=expansionArena(KITS), e=pinEnemy(h,'enemy_2071_skzdny',[9,7]),u=h.unit('wall');
  h.b.kill(e); h.run(6.9); assert.equal(h.b.enemies.filter(x=>x.defId==='enemy_2073_skzrck').length,0);
  h.run(.2); const thorn=h.b.enemies.find(x=>x.defId==='enemy_2073_skzrck'); assert.ok(thorn?.alive);
  pinEnemy(h,'enemy_2073_skzrck',[9,7]); h.run(1.1); assert.equal(u.elem.apoptosis,100);
  h.b.kill(thorn); assert.equal(h.b.flags.encounterLoot.conceptions,3); assert.equal(h.b.errorCount,0);
});
