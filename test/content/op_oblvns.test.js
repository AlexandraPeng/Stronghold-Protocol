import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
const C = 'char_4182_oblvns';
const unit = (uid, skill, col = 3) => ({ uid, chessId: 'chess_char_6_diy1_b', diy: { charId: C, skillIndex: skill }, row: 10, col });
function field(skill = 0, more = []) {
  const h = makeBattle({ autoFinish: false, timeLimit: 180, seed: 22, captureNoisy: true,
    hooks: ['damaged', 'attack', 'skillStart', 'feverStart', 'feverEnd'],
    defs: { enemies: { dummy: enemyRec({ key: 'dummy', hp: 1e7, atk: 0, speed: 0 }) } }, units: [unit(1, skill), ...more] });
  h.step(); return { h, u: h.unit(1), f: h.b.mujica };
}
const done = h => { checkInvariants(h.b); assert.deepEqual(h.b.errors, []); };
test('continuous attacks create moving notes and charge attack SP without targets', () => {
  const { h, u } = field(); h.run(3);
  assert.ok(u.stats.attacks >= 2); assert.ok(u.mem.sakiko.notes.length); assert.ok(u.skill.spTotal > 0); done(h);
});
test('normal notes home, deal physical damage, grant Fever and penetrate', () => {
  const { h, u, f } = field(); const e = h.spawn('dummy', { pos: [10, 5] }); h.run(6);
  const hits = h.hooksOf('damaged').filter(c => c.source === u && c.target === e);
  assert.ok(hits.length); assert.ok(hits.some(c => c.dmg.defIgnorePct > 0)); assert.ok(f.value > 0); done(h);
});
test('S1 full charge casts eight descending arts notes but does not start Fever', () => {
  const { h, u, f } = field(); u.atkCd = 99; f.value = 450; u.skill.gainSp(999, 'init');
  h.run(1.1); const notes = u.mem.sakiko.notes.filter(n => n.mode === 's1');
  assert.equal(notes.length, 8); assert.ok(notes.every(n => n.type === 'arts'));
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i - 1].amount >= notes[i].amount);
  assert.equal(f.until, 0); done(h);
});
test('Fever grants free S1 casts, shares state, ends after twenty seconds and preserves SP', () => {
  const { h, u, f } = field(0, [unit(2, 0, 2)]); f.value = 450; u.skill.gainSp(4, 'init');
  assert.ok(u.skill.activate('manual')); const sp = u.skill.spTotal;
  h.run(2); assert.ok(u.skill.activations > 1); assert.ok(h.unit(2).skill.activations > 0);
  assert.equal(u.skill.spTotal, sp); assert.equal(f.value, 0);
  h.run(19); assert.equal(f.participants.size, 0); done(h);
});
test('S2 changes tone, recovers attack SP, and Fever doubles current tone without switching', () => {
  const { h, u, f } = field(1); h.run(0.2); assert.ok(u.mem.sakiko.notes.some(n => n.mode === 'piano'));
  u.skill.gainSp(999, 'init'); u.skill.activate('manual'); assert.equal(u.mem.sakiko.organ, true);
  f.value = 450; f.start(); u.atkCd = 0; const before = u.mem.sakiko.notes.length; h.run(0.1);
  assert.equal(u.mem.sakiko.notes.length - before, 2); assert.equal(u.mem.sakiko.organ, true);
  assert.ok(u.skill.spTotal > 0); done(h);
});
test('S3 four notes select highest RES / DEF and both damage types', () => {
  const { h, u } = field(2); const e = h.spawn('dummy', { pos: [10, 5] }); const z = h.spawn('dummy', { pos: [11, 4] });
  h.b.addBuff(e, { key: 'res', mods: { resFlat: 80 } }); h.b.addBuff(z, { key: 'def', mods: { defFlat: 1000 } });
  u.skill.gainSp(999, 'init'); u.skill.activate('manual'); h.run(0.1);
  const notes = u.mem.sakiko.notes.filter(n => n.mode === 's3'); assert.equal(notes.length, 4);
  assert.ok(notes.filter(n => n.type === 'phys').every(n => n.target === e));
  assert.ok(notes.filter(n => n.type === 'arts').every(n => n.target === z)); done(h);
});
test('Fever pauses an existing S3 and expires newly forced S3; fatal protection retires its beneficiary', () => {
  const { h, u, f } = field(2, [unit(2, 2, 2)]); u.skill.gainSp(999, 'init'); u.skill.activate('manual'); h.run(2);
  const remaining = u.skill.timeLeft; f.value = 450; f.start(); h.run(0.2);
  assert.ok(h.unit(2).skill.active); h.b.dealDamage(null, h.unit(2), { amount: 1e8, type: 'true' });
  assert.ok(h.unit(2).alive); h.run(20);
  assert.equal(h.unit(2).alive, false); assert.ok(u.skill.active); assert.ok(Math.abs(u.skill.timeLeft - remaining) < 0.5); done(h);
});
test('separate battles have independent Fever and note state', () => {
  const a = field(), z = field(); a.f.gain(123); assert.equal(z.f.value, 0); assert.notEqual(a.f.notes, z.f.notes); done(a.h); done(z.h);
});

test('duplicate Sakiko talents do not multiply penetration or tempo, and dead sources lose their aura', () => {
  const { h, u, f } = field(0, [unit(2, 0, 2)]); const z = h.unit(2); h.run(0.1);
  const before = u.s.aspd; const buffs = u.buffs.filter(x => x.key === 'sakiko:tempo'); assert.equal(buffs.length, 1);
  for (let i = 0; i < 30; i++) f.notes.add({ dead: false });
  const dmg = { defIgnorePct: 0, resIgnorePct: 0 }; h.b.emit('hit', { source: u, dmg });
  assert.ok(dmg.defIgnorePct > 0 && dmg.defIgnorePct <= 0.31);
  assert.ok(dmg.resIgnorePct > 0 && dmg.resIgnorePct <= 0.31);
  h.b.kill(z); h.run(0.1); assert.equal(u.s.aspd, before); done(h);
});

test('untracked notes expire after the operator retreats', () => {
  const { h, u, f } = field(); h.run(0.3); assert.ok(f.notes.size);
  h.b.kill(u); h.run(0.2); assert.equal(f.notes.size, 0); done(h);
});
