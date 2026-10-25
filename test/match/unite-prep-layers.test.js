import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grantUnitePrepLayers } from '../../server/match/uniteExpansion.js';

test('support replays the prep-end layer amounts once per round without dispatching prep again', () => {
  const gains = [];
  const ps = { _lastPrepLayerGains: { victoriaShip: 4, yanShip: 3, bad: NaN, zero: 0 }, addLayers(...args) { gains.push(args); } };
  const m = { uniteStacking: true, round: 2 };
  grantUnitePrepLayers(m, ps);
  grantUnitePrepLayers(m, ps);
  assert.deepEqual(gains, [['victoriaShip', 4, { reason: 'unite-prep' }], ['yanShip', 3, { reason: 'unite-prep' }]]);
  m.round++;
  ps._lastPrepLayerGains = { victoriaShip: 2 };
  grantUnitePrepLayers(m, ps);
  assert.equal(gains.length, 3);
  assert.equal(gains[2][1], 2);
});
test('ordinary support grants no extra preparation layers', () => {
  grantUnitePrepLayers({ uniteStacking: false, round: 1 }, { addLayers() { assert.fail('ordinary mode'); } });
});
