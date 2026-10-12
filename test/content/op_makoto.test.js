import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
const C = 'char_4217_makoto';
function field(skill = 0, module = null) {
  const h = makeBattle({ autoFinish: false, timeLimit: 120, captureNoisy: true, hooks: ['damaged', 'healed', 'skillEnd'],
    defs: { enemies: { dummy: enemyRec({ key: 'dummy', hp: 1e7, atk: 0, speed: 0 }) } },
    units: [{ uid: 1, chessId: 'chess_char_6_diy1_b', diy: { charId: C, skillIndex: skill, uniEquipId: module }, row: 10, col: 3 }] });
  h.step(); const u = h.unit(1); return { h, u };
}
const start = u => { u.skill.gainSp(999, 'init'); assert.ok(u.skill.activate('test')); };
const done = h => { checkInvariants(h.b); assert.deepEqual(h.b.errors, []); };
test('all three skills switch, hold SP, return, and perform true total attack', () => {
  for (const skill of [0, 1, 2]) {
    const { h, u } = field(skill); const e = h.spawn('dummy', { pos: [10, 4] }); start(u);
    assert.equal(u.trait.doll, true); assert.equal(u.skill.active, false);
    const sp = u.skill.spTotal; h.run(2); assert.equal(u.skill.spTotal, sp);
    assert.ok(e.hp < e.s.maxHp); h.run(20);
    assert.ok(h.hooksOf('damaged').some(c => c.dmg.tags.includes('makoto:total')));
    h.run(2); done(h);
  }
});
test('S3 fatal substitutes keep original expiry, restore blocking, heal, and finally die', () => {
  const { h, u } = field(2); start(u); h.run(1.1); const until = u.mem.makoto.until;
  h.b.dealDamage(null, u, { amount: 1e7, type: 'true' });
  assert.ok(u.alive); assert.equal(u.mem.makoto.phase, 'orpheus'); assert.equal(u.mem.makoto.until, until);
  h.run(1.1); assert.equal(u.s.blockCnt, 2); u.hp = 100; h.run(1.6); assert.ok(u.hp > 100);
  h.b.dealDamage(null, u, { amount: 1e7, type: 'true' }); assert.equal(u.alive, false); done(h);
});
test('S3 second cast is free, switch-only, with no renewed substitute duration', () => {
  const { h, u } = field(2); start(u); assert.equal(u.skill.activate('manual'), false);
  h.run(1.1); const until = u.mem.makoto.until; assert.ok(u.skill.activate('manual'));
  assert.equal(u.mem.makoto.phase, 'orpheus'); assert.equal(u.mem.makoto.until, until);
  assert.equal(u.skill.activate('manual'), false); done(h);
});
test('S1 prioritizes a target at exactly half HP over attacking', () => {
  const { h, u } = field(0); const e = h.spawn('dummy', { pos: [10, 4] }); start(u); h.run(1.1);
  u.hp = u.s.maxHp / 2; u.atkCd = 0; const oldHp = u.hp, enemyHp = e.hp;
  h.run(0.1); assert.ok(u.hp > oldHp); assert.equal(e.hp, enemyHp); done(h);
});
test('S2 fear execution works independently of attack cooldown', () => {
  const { h, u } = field(1); const e = h.spawn('dummy', { pos: [10, 4] }); start(u); h.run(1.1);
  u.atkCd = 10; h.b.applyStatus(e, 'fear', { duration: 3, source: u }); e.hp = 100;
  h.run(0.2); assert.equal(e.alive, false); done(h);
});
test('S3 chooses weakness damage after penetration', () => {
  const { h, u } = field(2); const e = h.spawn('dummy', { pos: [10, 4] });
  h.b.addBuff(e, { key: 'res', mods: { resFlat: 90 } }); start(u); h.run(2);
  assert.ok(h.hooksOf('damaged').some(c => c.source === u && c.dmg.tags.includes('makoto:weak') && c.dmg.type === 'phys')); done(h);
});
test('PUM-Y raises substitute HP and enhanced talent values', () => {
  const { h, u } = field(0, 'uniequip_002_makoto'); const hp = u.s.maxHp; start(u);
  assert.ok(Math.abs(u.s.maxHp / hp - 1.6) < 1e-6); done(h);
});

test('execution consumes a hit barrier, while an HP shield still absorbs damage', () => {
  const { h, u } = field(1); const e = h.spawn('dummy', { pos: [10, 4] }); start(u); h.run(1.1);
  u.atkCd = 99; h.b.applyStatus(e, 'fear', { duration: 3, source: u }); e.hp = 100;
  h.b.addBuff(e, { key: 'barrier', shieldHits: 2 });
  h.run(0.11); assert.equal(e.alive, false); assert.equal(e.findBuff('barrier')?.shieldHits, 1); done(h);
  const z = field(1), target = z.h.spawn('dummy', { pos: [10, 4] }); start(z.u); z.h.run(1.1);
  z.u.atkCd = 99; z.h.b.applyStatus(target, 'fear', { duration: 3, source: z.u }); target.hp = 100;
  z.h.b.addBuff(target, { key: 'hpShield', shield: 2e7 }); z.h.run(0.11);
  assert.equal(target.hp, 100); assert.ok(target.findBuff('hpShield').shield < 2e7); done(z.h);
});

test('S3 automatically switches defensively when a healable ally falls to half HP', () => {
  const { h, u } = field(2); start(u); h.run(5.1); const until = u.mem.makoto.until;
  u.hp = u.s.maxHp * 0.4; h.run(0.1);
  assert.equal(u.mem.makoto.phase, 'orpheus'); assert.equal(u.mem.makoto.until, until); done(h);
});
