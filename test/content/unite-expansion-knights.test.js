import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_KNIGHT_KITS } from '../../server/sim/content/enemies/uniteExpansion/knights.js';
const arena = () => expansionArena(UNITE_KNIGHT_KITS);
test('knight statues: independently wake at Wiki defaults 30, 50, 75 and 105 seconds', () => {
  const h = arena(), rows = [ ['enemy_2113_dyhlg2',30], ['enemy_2114_dylbgg',50],
    ['enemy_2115_dylbg2',50], ['enemy_2110_dyyrzf',75], ['enemy_2112_dyhlgy',105] ];
  const es = rows.map(([key]) => pinEnemy(h, key));
  for (const e of es) { assert.ok(e.s.flags.invulnerable); assert.ok(e.s.flags.unblockable); }
  let time = 0;
  for (const end of [30,50,75,105]) {
    h.run(end - time + (time === 0 ? .1 : 0)); time = end;
    rows.forEach(([,wake],i) => assert.equal(es[i].mem.uniteKnight.phase, wake <= end ? 'normal' : 'statue'));
  }
  assert.equal(h.b.errorCount, 0);
});
test('knight leader: each active companion supplies a multiplicative 60% physical/arts guard; departure removes it', () => {
  const h = arena(), leader = pinEnemy(h,'enemy_2114_dylbgg'), a = pinEnemy(h,'enemy_2110_dyyrzf'), b = pinEnemy(h,'enemy_2112_dyhlgy');
  h.run(106); assert.ok(Math.abs(leader.s.physTakenMul - .36) < 1e-9); assert.ok(a.s.flags.uniteKnightLeader);
  h.b.leak(b); h.run(.2); assert.equal(leader.s.physTakenMul,.6);
  h.b.leak(leader); assert.equal(a.s.flags.uniteKnightLeader,undefined); assert.equal(h.b.errorCount,0);
});
test('knight healer: charges only after waking, heals lowest ratio, and grants one-second perfect resist', () => {
  const h = arena(), leader=pinEnemy(h,'enemy_2114_dylbgg'), ally=pinEnemy(h,'enemy_2113_dyhlg2');
  h.run(51); ally.hp=1000; h.b.applyStatus(ally,'cold',{duration:50}); h.run(13);
  assert.equal(ally.hp,1000); h.run(1.2); assert.equal(ally.hp,4000); assert.equal(ally.s.flags.cold,undefined);
  assert.equal(h.b.applyStatus(ally,'stun',{duration:10}),false);
  h.run(1.1); assert.equal(h.b.applyStatus(ally,'stun',{duration:10}),true); assert.equal(h.b.errorCount,0);
});
test('spear: vulnerability follows its current blocker and ends immediately on death', () => {
  const h=arena(), e=pinEnemy(h,'enemy_2110_dyyrzf'), u=h.unit('wall'); h.run(76);
  e.blockedBy=u; h.b.emit('blocked',{enemy:e,blocker:u}); assert.equal(u.s.physTakenMul,1.5); assert.equal(e.s.physTakenMul,1.5);
  h.b.addBuff(e,{key:'test:leader',persist:true,flags:{uniteKnightLeader:true}}); h.step(); assert.equal(u.s.artsTakenMul,2);
  h.b.kill(e); assert.equal(u.s.physTakenMul,1); assert.equal(h.b.errorCount,0);
});
