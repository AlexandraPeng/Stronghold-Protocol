// PRTS WW09 / WW11, 临时收音师 and 心虚设计师, checked 2026-10-14.
import { elem, setForm } from '../helpers.js';
import { reborn } from '../archetypes.js';
import { filmed, cameras } from './environment.js';

function recorder() { return [{ dealt(c, b, e) { if (!filmed(b, e)) elem(b, e, c.target, 'neural', e.s.atk * .2); } }]; }
function designer() {
  return [{
    spawn(b, e, a) { e.profile.noAttack = true; a.facing = -1; a.x = e.x; a.clock = 0; },
    tick(b, e, a, dt) {
      if (Math.abs(e.x - a.x) > 1e-6) a.facing = Math.sign(e.x - a.x);
      a.x = e.x;
      a.ashamed = filmed(b, e) && cameras(b).some(c => (c.x - e.x) * a.facing >= 0);
      a.clock += dt;
      if (a.clock < 1 - 1e-9) return; a.clock -= 1;
      const target = e.blockedBy;
      if (target?.alive && b.time >= (target.mem.uniteDesignerAt ?? -Infinity) + 1 - 1e-9) {
        target.mem.uniteDesignerAt = b.time; elem(b, e, target, 'neural', e.s.atk * .15);
      }
    },
    hitIn(c, b, e, a) {
      if (!c.source || !['phys', 'arts'].includes(c.dmg.type)) return;
      const facing = a.ashamed ? -a.facing : a.facing;
      if ((c.source.x - e.x) * facing > 1e-6) c.dmg.mul *= .2;
    },
  }];
}
function actor(hero) {
  const foes = new Set(hero ? ['enemy_10099_crvln', 'enemy_10099_crvln_2'] : ['enemy_10098_crhro', 'enemy_10098_crhro_2']);
  return [...(hero ? [reborn({ dur: 3 })] : []), {
    iv: hero ? .1 : .2,
    spawn(b, e, a) {
      a.performing = false; e.profile.deferHit = true; e.profile.shot = 'enemy';
      e.profile.canTarget = u => !u.isFlying;
      e.profile.extraAttackTargets = (battle, self, reach) => a.performing
        ? battle.enemiesInRadius(self.x, self.y, reach).filter(o => o !== self && foes.has(o.defId) && !o.hidden && !o.s.flags.untargetable)
        : [];
      e.profile.targetPriority = u => foes.has(u.defId) ? 2 : u === e.blockedBy ? 1 : 0;
    },
    tick(b, e, a) {
      if (e.hidden) return;
      a.performing = filmed(b, e);
      e.profile.rangeRadius = e.base.rangeRadius + (hero && a.performing ? 2 : 0);
      e.profile.blockFree = a.performing;
      e.profile.canTarget = u => (hero && a.performing) || !u.isFlying;
      if (a.performing && !a.read) { a.read = true; e.skillAnimUntil = b.time + 2; setForm(b, e, 'perform'); }
    },
    attack(c, b, e, a) {
      const n = !hero && a.performing ? 2 : 1;
      for (const target of c.targets) for (let i = 0; i < n; i++) {
        const amount = e.s.atk * (foes.has(target.defId) ? 5 : 1);
        b.addProjectile({ from: e, target, visual: 'enemy', source: e, onHit: ({ target: t }) => {
          if (!t) return;
          const landed = b.dealDamage(e, t, { amount, type: e.def.dmgType, isAttack: true, isProjectile: true, tags: ['ux:actor'] });
          if (landed > 0 && t.alive) elem(b, e, t, 'neural', e.s.atk * .15);
        } });
      }
    },
  }];
}
export const UNITE_FILM_KITS = Object.freeze({
  enemy_10094_crstf: recorder, enemy_10097_crshd: designer,
  enemy_10098_crhro: () => actor(true), enemy_10099_crvln: () => actor(false),
});
