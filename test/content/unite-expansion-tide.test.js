import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeBattle, chessRec } from '../helpers/battleHarness.js';
import * as enemies from '../../server/sim/content/enemies.js';
import { UNITE_TIDE_KITS } from '../../server/sim/content/enemies/uniteExpansion/tide.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../../data/workshop-enemies.json', import.meta.url))).enemies;
const defs = Object.fromEntries(Object.keys(UNITE_TIDE_KITS).map(k => [k, catalog[k].levels[0]]));
const expansion = { install(b) { enemies.ensureInstalled(b, {...enemies.KITS,...UNITE_TIDE_KITS}); } };
function arena() {
  const h = makeBattle({ content: 'generic', extraContent: [expansion], autoFinish: false, timeLimit: 100,
    defs: { enemies: defs, chess: { wall: chessRec({ id: 'wall', stats: { atk: 0, maxHp: 1e7 }, skill: null }) } },
    kits: { wall: () => ({ trait: { noAttack: true } }) }, units: [{ chessId: 'wall', row: 9, col: 5 }], captureNoisy: true });
  h.step(); return h;
}
function put(h, key, pair = 'a') {
  const e = h.spawn(key, { pos: [9, 9], routeIndex: 0, mods: { unitePairId: pair } });
  h.b.addBuff(e, { key: 'test:pin', persist: true, flags: { noMove: true } }); return e;
}

test('tide: a partner that leaked while the survivor was healthy cannot cause an endless resurrection', () => {
  const h = arena(), priest = put(h, 'enemy_2028_syevil'), body = put(h, 'enemy_2029_symon');
  h.b.leak(body); h.b.kill(priest); assert.equal(priest.alive, false);
  const orphan = put(h, 'enemy_2030_symon2'); orphan.mods.unitePairTerminal = true;
  h.b.kill(orphan); assert.equal(orphan.alive, false); assert.equal(h.b.errorCount, 0);
});
test('tide: first KO is hidden from kill rewards, revives at 2%, regenerates and can be knocked down again', () => {
  const h = arena(), e = put(h, 'enemy_2028_syevil');
  h.b.kill(e, h.unit('wall')); assert.ok(e.alive); assert.equal(h.b.killed, 0);
  h.run(.12); assert.equal(e.hp, e.s.maxHp * .02); assert.equal(e.mem.uniteTide.phase, 'down');
  h.run(20.1); assert.equal(e.mem.uniteTide.phase, 'normal'); assert.equal(e.hp, e.s.maxHp);
  h.b.kill(e); assert.ok(e.alive); h.run(.12); assert.equal(e.mem.uniteTide.phase, 'down');
  assert.equal(h.b.errorCount, 0);
});
test('tide: two simultaneously defeated halves die once each after rebirth, with no recursive resurrection', () => {
  const h = arena(), priest = put(h, 'enemy_2028_syevil'), body = put(h, 'enemy_2029_symon');
  h.b.kill(priest); h.b.kill(body); h.run(.2);
  assert.equal(priest.alive, false); assert.equal(body.alive, false);
  assert.equal(h.hooksOf('death').filter(c => c.unit === priest || c.unit === body).length, 2);
  assert.equal(h.b.errorCount, 0);
});
test('tide: a partner leak finishes a downed half, but another bounty pair cannot finish it', () => {
  const h = arena(), priest = put(h, 'enemy_2028_syevil'), body = put(h, 'enemy_2030_symon2');
  const other = put(h, 'enemy_2029_symon', 'b');
  h.b.kill(priest); h.run(.2); h.b.leak(other); assert.ok(priest.alive);
  h.b.leak(body); assert.equal(priest.alive, false); assert.equal(h.b.errorCount, 0);
});
test('tide: stronger body heals at 10% per second and ordinary hits inflict 50% erosion', () => {
  const h = arena(), body = put(h, 'enemy_2030_symon2'), u = h.unit('wall');
  h.b.dealDamage(body, u, { amount: 1, type: 'phys', isAttack: true });
  h.b.kill(body); h.run(1.2); assert.equal(body.hp, body.s.maxHp * .12);
  assert.equal(h.b.errorCount, 0);
});
