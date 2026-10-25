// PRTS 塑路者 / 延命塑路者 / 塑路者分形 (2026-10-14).
import { spawnChildren } from '../helpers.js';

const CHILD = 'enemy_2033_syboys';
export function nearestGround(b, e) {
  const R = b.grid.rect; let best = null, distance = Infinity;
  // Equal distances use row, then column: deterministic [ASSUMED] tie-break.
  for (let r = R.r0; r <= R.r1; r++) for (let c = R.c0; c <= R.c1; c++) {
    if (!b.grid.groundPassable(r, c)) continue;
    const d = (r - e.y) * (r - e.y) + (c - e.x) * (c - e.x);
    if (d < distance) { best = [r, c]; distance = d; }
  }
  return best;
}
function summon(b, e, limit) {
  if (!e.alive || e.hp <= 0) return;
  if (b.enemies.filter(o => o.alive && o.defId === CHILD).length >= limit) return;
  const p = nearestGround(b, e); if (!p) return;
  const children = spawnChildren(b, e, CHILD, 1, { pos: [p[0] + (b.rng() - .5) * .4, p[1] + (b.rng() - .5) * .4] });
  for (const child of children) child.hp = child.s.maxHp * e.hpRatio;
}
function fractal({ damageCount = 0, child = false } = {}) {
  return [{
    spawn(b, e, a) { a.attacks = 0; a.hits = 0; if (child) b.after(90, () => { if (e.alive) b._remove(e, 'expired'); }); },
    attack(c, b, e, a) {
      // The skill replaces every third attack, including a dodged attack. The Wiki's
      // child header says 3 SP, but its skill explicitly specifies a 2-SP cost.
      if (++a.attacks % 3 === 0) summon(b, e, child ? 12 : 8);
    },
    taken(c, b, e, a) { if (damageCount && c.amount > 0 && ++a.hits % damageCount === 0) summon(b, e, 8); },
    death(c, b) {
      if (child) return;
      for (const o of b.enemies.slice()) if (o.alive && o.defId === CHILD) b._remove(o, 'expired');
    },
  }];
}
export const UNITE_FRACTAL_KITS = Object.freeze({
  enemy_2031_syboy: () => fractal({ damageCount: 10 }),
  enemy_2032_syboy2: () => fractal({ damageCount: 5 }),
  [CHILD]: () => fractal({ child: true }),
});
