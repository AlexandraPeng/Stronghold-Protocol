import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlace } from '../../public/js/ui/gameLogic/placement.js';

for (const isDiy of [true, false]) {
  test(`beacon placement respects custom target restriction: ${isDiy}`, () => {
    const ctx = {
      editable: true,
      pieces: new Map([[1, { area: 'hand', idx: 0, piece: { id: 'beacon', kind: 'item' } }]]),
      handAt: new Map([[1, { piece: { id: 'operator', kind: 'chess' } }]]),
      getItem: () => ({ itemType: 'EQUIP', buffs: [{ key: 'use_equip_recruit_new_char_and_give_char_to_player_most_bond' }] }),
      getChess: () => ({ isDiy }),
    };
    const result = canPlace(ctx, 1, { area: 'hand', idx: 1 });
    assert.equal(result.ok, !isDiy);
    if (isDiy) assert.equal(result.code, 'BAD_TARGET');
  });
}
