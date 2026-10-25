import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, checkInvariants } from '../helpers/battleHarness.js';
import * as enemies from '../../server/sim/content/enemies.js';
import { UNITE_ENEMY_KEYS, UNITE_SUMMON_KEYS } from '../../shared/uniteWaveDesign.js';

// Production data and the real dispatcher, including delayed callbacks and cleanup.
for (const key of [...UNITE_ENEMY_KEYS, ...UNITE_SUMMON_KEYS]) test(`unite runtime: ${key}`, () => {
  const h = makeBattle({ content: 'generic', extraContent: [enemies], autoFinish: false, timeLimit: 180,
    flags: { uniteExpansion: true, filmingZones: [{r0: 8, r1: 10, c0: 4, c1: 9}],
      filmingCameras: [{x: 9, y: 9}], transformedTiles: [[9, 7]], smokeTiles: [[9, 7]], iceCrystalTiles: [[8, 8]] },
    defs: {chess: {wall: chessRec({id: 'wall', stats: {atk: 0, maxHp: 1e7, blockCnt: 10}, skill: null})}},
    kits: {wall: () => ({trait: {noAttack: true}})}, units: [{chessId: 'wall', row: 9, col: 5}], captureNoisy: true });
  h.step();
  const e = h.spawn(key, {pos: [9, 5.2], routeIndex: 0, mods: {speedMul: 0}});
  h.run(120); checkInvariants(h.b);
  if (e.alive) h.b.kill(e, h.unit('wall'));
  h.run(12); checkInvariants(h.b);
  assert.equal(h.b.errorCount, 0, key);
});
