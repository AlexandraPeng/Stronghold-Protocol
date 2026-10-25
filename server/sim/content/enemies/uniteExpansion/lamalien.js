// PRTS 菈玛莲 / 饮泣之刺 / 年代印痕(x-2).
import { elem, spawnChildren } from '../helpers.js';
const THORN = 'enemy_2073_skzrck';
function lamalien() {
  return [{
    dealt(c, b, e) { elem(b, e, c.target, 'apoptosis', e.s.atk * .2); },
    death(c, b, e) {
      if (c.reason !== 'killed') return;
      const pos = [Math.round(e.y), Math.round(e.x)];
      b.after(7, () => spawnChildren(b, e, THORN, 1, { pos, countInTotal: false,
        route: { motion: 'WALK', start: pos, end: pos, steps: [{ t: 'wait', s: 99999 }] } }));
    },
  }];
}
function thorn() {
  return [{
    spawn(b, e, a, ab) {
      e.profile.noAttack = true; e.mem.nonPrimary = true; e.counted = false; a.clock = 0;
      ab.immune = new Set([...(ab.immune ?? []), 'stun', 'freeze', 'silence', 'sleep']);
      b.addBuff(e, { key: 'ux:thorn', persist: true, flags: { noMove: true, noDisplace: true, healFree: true, unblockable: true } });
    },
    tick(b, e, a, dt) {
      a.clock += dt; if (a.clock < 1-1e-9) return; a.clock -= 1;
      const tiles = [];
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        if (Math.abs(dr)+Math.abs(dc) <= 3) tiles.push([Math.round(e.y)+dr, Math.round(e.x)+dc]);
      }
      b.fx('telegraph', { id: e.id, x: e.x, y: e.y, kind: 'ageImprint', tiles, dur: 1.05 });
      for (const u of b.allies()) {
        const dr = Math.abs(u.tileR-Math.round(e.y)), dc = Math.abs(u.tileC-Math.round(e.x));
        if (dr > 2 || dc > 2 || dr+dc > 3 || u.s.flags.dyingFeatherBeast) continue;
        if (b.time < (u.mem.uniteImprintAt ?? -Infinity)+1-1e-9) continue;
        u.mem.uniteImprintAt = b.time; elem(b, e, u, 'apoptosis', 100, { ignoreSelect: true });
      }
    },
    death(c, b) {
      // 构想 is a Sami/Sarkaz roguelike resource, never converted to match money.
      if (c.reason === 'killed') (b.flags.encounterLoot ??= {}).conceptions = (b.flags.encounterLoot.conceptions ?? 0)+3;
    },
  }];
}
export const UNITE_LAMALIEN_KITS = Object.freeze({ enemy_2071_skzdny: lamalien, [THORN]: thorn });
