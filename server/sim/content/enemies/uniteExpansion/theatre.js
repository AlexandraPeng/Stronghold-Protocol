// PRTS 投矛的士兵/勇士, 新手/见习祭司学徒, 自制/翻新投石机 (2026-10-14).
import { noAirTargets } from '../archetypes.js';
import { areaAllies, setForm } from '../helpers.js';

function spear() {
  return [noAirTargets(), {
    spawn(b, e, a) {
      e.profile.melee = false; e.profile.rangeRadius = 2;
      b.on('dodge', c => {
        if (c.source !== e || !c.dmg.isAttack || a.missed) return;
        a.missed = true; e.profile.melee = true;
      }, { owner: e });
    },
    cd: 1, left: 0,
    cond(b, e, a) { return a.missed && !a.melee; },
    fire(b, e, a) { a.melee = true; e.profile.melee = true; setForm(b, e, 'melee'); },
  }];
}
function apprentice() {
  return [{ sil: true, death(c, b, e) {
    if (c.reason !== 'killed') return;
    const nearby = b.enemiesInRadius(e.x, e.y, 1.2).filter(o => o.alive);
    for (const o of nearby) b.heal(e, o, e.s.atk * 5);
    const fountains = [...nearby, ...b.alliesInRadius(e.x, e.y, 1.2)].filter(o => o.s.flags.fountainPool);
    fountains.sort((x, y) => y.s.taunt - x.s.taunt || y.aggroSeq - x.aggroSeq);
    if (fountains[0]) b.heal(e, fountains[0], 3000);
  } }];
}
function catapult() {
  return [{
    spawn(b, e) { e.profile.blockFree = true; e.profile.deferHit = true; e.profile.shot = 'shell'; },
    attack(c, b, e) {
      const theatre = !!e.s.flags.theatreEnemy, amount = e.s.atk;
      for (const target of c.targets) for (let i = 0; i < 3; i++) {
        const aim = theatre ? { x: target.x + (b.rng() - .5) * 6, y: target.y + (b.rng() - .5) * 6 } : null;
        b.addProjectile({ from: e, target: aim ? null : target, to: aim, hitDead: true, source: e, visual: 'shell', onHit: ({ x, y }) => {
          for (const u of areaAllies(b, e, x, y, theatre ? .5 : 1.5)) b.dealDamage(e, u, {
            amount, type: 'phys', isAttack: true, isProjectile: true, canDodge: true, tags: ['ux:catapult', 'splash'],
          });
        } });
      }
    },
  }];
}
export const UNITE_THEATRE_KITS = Object.freeze({
  enemy_10155_mntjsd: spear, enemy_10155_mntjsd_2: spear,
  enemy_10156_mncrer: apprentice, enemy_10156_mncrer_2: apprentice,
  enemy_10162_mnctpt: catapult, enemy_10162_mnctpt_2: catapult,
});
