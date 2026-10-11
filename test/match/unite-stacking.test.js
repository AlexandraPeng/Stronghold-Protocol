import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';
import { FakeBattle } from './fakeBattle.js';
import { buildBattleSpec, createBattleFromSpec } from '../../server/sim/spec.js';
import { validateClientResult } from '../../server/match/fields.js';
import { gainLayers } from '../../server/sim/content/support/index.js';

for (const uniteStacking of [false, true]) {
  test(`unite increments settle once and carry into next round: stacking=${uniteStacking}`, () => {
    const h = makeMatch({ mode: 'coop', difficulty: 'NORMAL', uniteStacking, humans: 2, fake: true,
      script: (b) => b.kind === 'normal'
        ? { leaks: { p_1: 2 }, layerGains: { p_0: { yanShip: 5 } } }
        : { layerGains: { p_0: { yanShip: 7 } } },
    }).start();
    try {
      h.toPrep(1);
      const ps = h.ps('p_0');
      ps.layers.yanShip = 10; ps.recompute();
      assert.equal(h.m.difficulty, uniteStacking ? 'ABYSS' : 'NORMAL');
      assert.equal(h.m.gd.difficulty, h.m.difficulty);
      h.drive(() => h.m.phase === 'UNITE');
      const battle = FakeBattle.instances.find((b) => b.kind === 'unite');
      assert.equal(battle.opts.flags.layerGainsEnabled, uniteStacking);
      assert.equal(battle.opts.players.find((p) => p.playerId === ps.playerId).bonds.yanShip.layers, 15);
      h.drive(() => h.m.phase === 'SETTLE');
      assert.equal(ps.layers.yanShip, uniteStacking ? 22 : 15);
      h.toPrep(2);
      assert.equal(ps.layers.yanShip, uniteStacking ? 22 : 15);
    } finally { h.m.dispose(); }
  });
}

test('real unite simulation accepts all existing permanent-layer sources and respects the cap', () => {
  const h = makeMatch({ uniteStacking: true, humans: 2, fake: true }).start();
  try {
    h.toPrep(1);
    const helper = h.ps('p_0');
    helper.layers.yanShip = 995; helper.recompute();
    const opts = h.m._uniteOpts({ helpers: [helper], leaked: [] }, 20);
    const spec = buildBattleSpec({ ...opts, battleId: 'stacking-test' });
    const b = createBattleFromSpec(JSON.parse(JSON.stringify(spec)), h.m.data);
    for (const reason of ['garrison', 'item', 'bond']) {
      assert.equal(gainLayers(b, { playerId: 'p_0', bonds: 'yanShip', n: 1, requireActive: false, reason }), 1);
    }
    assert.equal(gainLayers(b, { playerId: 'p_0', bonds: 'yanShip', n: 20, requireActive: false }), 1);
    assert.equal(b.result().perPlayer.p_0.layerGains.yanShip, 4);
    const result = b.result();
    const checked = validateClientResult(spec, { ...result, reason: 'cleared' }, { gd: h.m.gd });
    assert.equal(checked.ok, true, JSON.stringify(checked));
    h.m.lastResults.set('p_0', { leaked: [], perfect: true, layerGains: {} });
    h.m.settle({ helpers: [helper], leakers: [], leaked: [], notReentered: [] }, result);
    assert.equal(helper.layers.yanShip, 999);
  } finally { h.m.dispose(); }
});
