// Isolated content fixture: no runtime registration, generated data edits or production access.
import fs from 'node:fs';
import { makeBattle, chessRec } from './battleHarness.js';
import * as enemies from '../../server/sim/content/enemies.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../../data/workshop-enemies.json', import.meta.url))).enemies;
export function expansionArena(kits, overrides = {}) {
  const defs = Object.fromEntries(Object.keys(kits).map(k => [k, catalog[k].levels[0]]));
  const expansion = { install(b) { enemies.ensureInstalled(b, { ...enemies.KITS, ...kits }); } };
  const h = makeBattle({ content: 'generic', extraContent: [expansion], autoFinish: false, timeLimit: 200,
    defs: { enemies: defs, chess: { wall: chessRec({ id: 'wall', stats: { atk: 0, maxHp: 1e7, def: 500, blockCnt: 5 }, skill: null }) } },
    kits: { wall: () => ({ trait: { noAttack: true } }) }, units: [{ chessId: 'wall', row: 9, col: 5 }], captureNoisy: true, ...overrides });
  h.step(); return h;
}
export function pinEnemy(h, key, pos = [9, 8], mods = {}) {
  const e = h.spawn(key, { pos, routeIndex: 0, mods });
  h.b.addBuff(e, { key: 'test:pin', persist: true, flags: { noMove: true } }); return e;
}
