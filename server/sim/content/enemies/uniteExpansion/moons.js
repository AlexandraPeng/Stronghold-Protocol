// PRTS 夕娥 / 双月共主: floating is a form, not a replacement flying route.
import { setFloat } from '../archetypes.js';
import { canCast, setForm, spawnChildren } from '../helpers.js';
const PAPER = 'enemy_2101_dyspll', SEAL = 'enemy_2121_dyspl2';
const CONTROL = new Set(['stun', 'freeze', 'sleep', 'levitate']);
function nearby(b, e, radius) {
  return b.enemiesInRadius(e.x, e.y, radius).filter(u => !u.hidden && (u.defId === PAPER || u.defId === SEAL))
    .sort((a, c) => Number(c.defId === PAPER) - Number(a.defId === PAPER));
}
function moon(twin) {
  const form = (b, e, a, floating) => {
    a.floating = floating; setFloat(b, e, floating);
    e.profile.rangeRadius = e.base.rangeRadius * (twin && floating ? 2 : 1);
    if (!twin && floating) b.addBuff(e, { key: 'ux:moonDodge', persist: true, mods: { dodgePhys: .5, dodgeArts: .5 } });
    else b.removeBuff(e, 'ux:moonDodge');
    setForm(b, e, floating ? 'float' : 'ground');
  };
  const eat = (b, e, target) => {
    if (twin) {
      b.kill(target); b.addBuff(e, { key: 'ux:moonHaste', duration: 10, mods: { aspd: 50 } });
    } else if (e.hp < e.s.maxHp) { b.kill(target); b.heal(e, e, e.s.maxHp * .2); }
  };
  return [{
    spawn(b, e, a) { form(b, e, a, !twin); },
    status(c, b, e, a) {
      if (!a.floating || !CONTROL.has(c.status)) return;
      form(b, e, a, false); b.applyStatus(e, 'stun', { duration: .5, source: e });
    },
    tick(b, e, a) {
      e.profile.maxTargets = e.blockedBy ? 1 : 2;
      if (e.hidden) return;
      if (a.floating) {
        // The passive absorption is independent of the active skill's control restrictions.
        if (twin || e.hp < e.s.maxHp) for (const target of nearby(b, e, twin ? 1.5 : 1.3)) {
          if (!twin && e.hp >= e.s.maxHp) break;
          eat(b, e, target);
        }
      } else if (canCast(e, false, b)) {
        const target = nearby(b, e, .8)[0];
        if (target) { eat(b, e, target); form(b, e, a, true); }
      }
    },
  }, {
    cd: 10, left: 15,
    cond(b) { return !!b.flags.transformedTiles?.length; },
    fire(b, e) {
      const tiles = [...b.flags.transformedTiles];
      for (let i = 0; i < (twin ? 3 : 1) && tiles.length; i++) {
        const pos = tiles.splice(Math.floor(b.rng() * tiles.length), 1)[0];
        const child = spawnChildren(b, e, PAPER, 1, { pos,
          route: { motion: 'FLY', start: pos, end: pos, steps: [{ t: 'wait', s: 99999 }] }, countInTotal: false })[0];
        if (child) {
          child.x += (b.rng() - .5) * .8; child.y += (b.rng() - .5) * .8;
          b.addBuff(child, { key: 'ux:boundPaper', persist: true, flags: { noMove: true } });
        }
      }
    },
  }];
}
export const UNITE_MOON_KITS = Object.freeze({ enemy_2108_dypryg: () => moon(false), enemy_2109_dypry2: () => moon(true) });
