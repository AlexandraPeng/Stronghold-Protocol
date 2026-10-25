import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPersonalShield, absorbPersonalLoss, absorbTeamLoss } from '../../server/match/personalShield.js';
const player = (shield = 0, stacking = true, lp = 20) => ({ m: { uniteStacking: stacking }, lpShield: shield, lpAtFinal: lp, dirty() {} });
test('personal shields absorb only actual capped damage and carry their unused balance', () => {
  const ps = player();
  assert.equal(addPersonalShield(ps, 5), 5);
  assert.deepEqual(absorbPersonalLoss(ps, 3), { loss: 0, absorbed: 3 });
  assert.equal(ps.lpShield, 2);
  assert.deepEqual(absorbPersonalLoss(ps, 4), { loss: 2, absorbed: 2 });
  assert.equal(ps.lpShield, 0);
  assert.deepEqual(absorbPersonalLoss(ps, NaN), { loss: 0, absorbed: 0 });
});
test('ordinary modes ignore shields entirely', () => {
  const ps = player(5, false);
  assert.equal(addPersonalShield(ps, 3), 0);
  assert.deepEqual(absorbPersonalLoss(ps, 4), { loss: 4, absorbed: 0 });
  assert.equal(ps.lpShield, 5);
});
test('a leader hit charges personal shares; one shield cannot protect the teammate', () => {
  const a = player(20, true, 30), b = player(0, true, 10);
  assert.equal(absorbTeamLoss([a, b], 8), 2);
  assert.equal(a.lpShield, 14);
  assert.equal(b.lpShield, 0);
  assert.equal(absorbTeamLoss([a, b], 8), 2);
  assert.equal(a.lpShield, 8);
});
