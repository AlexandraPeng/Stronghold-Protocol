import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';
test('extra bench is persistent, usable, and restricted by the server to stacking mode', () => {
  for (const stacking of [false, true]) {
    const h = makeMatch({ mode:'coop', uniteStacking:stacking, humans:2, fake:true }).start();
    try {
      h.toPrep(1);
      const ps = h.ps('p_0');
      assert.equal(ps.hand.length, stacking ? 20 : 10);
      assert.equal(ps.gd.benchSize, ps.hand.length);
      const id = ps.gd.shopChessByTier?.[1]?.[0] || Object.keys(h.m.data.chess).find(id => !h.m.data.chess[id].isGolden);
      const p = ps.acquireChess(id);
      assert.ok(p);
      const result = ps.move(p.uid, { area:'hand', idx:19 });
      if (stacking) {
        assert.equal(result.ok, true);
        assert.equal(ps.find(p.uid).idx, 19);
        assert.equal(ps.privateView().hand[19].uid, p.uid);
      } else assert.ok(result.error);
    } finally { h.m.dispose(); }
  }
});
