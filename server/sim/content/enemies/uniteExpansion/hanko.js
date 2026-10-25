// PRTS “大总统”汉科 and 烟雾弹. Smoke placement belongs to encounter configuration.
import { byPriority, hurt, spawnChildren, canCast } from '../helpers.js';
import { blinkTo } from './elements.js';
import { hypot } from '../../../detmath.js';
const SMOKE = 'enemy_2156_shsmok';
const box = (u, x, y) => Math.abs(Math.round(u.x) - Math.round(x)) <= 1 && Math.abs(Math.round(u.y) - Math.round(y)) <= 1;
function visibleTargets(b, e, reach) {
  return b.alliesInRadius(e.x, e.y, reach).filter(u => !u.hidden && !u.s.flags.untargetable && !u.s.flags.sleep);
}
function smoke() {
  const clear = (b, e, a) => { for (const u of a.affected ?? []) b.removeBuff(u, `ux:smoke:${e.id}`); a.affected = []; };
  return [{
    spawn(b, e, a) {
      e.def = { ...e.def, staticBody: true }; e.profile.noAttack = true; e.mem.nonPrimary = true; e.counted = false;
      a.start = b.time + .75; a.expire = b.time + 300;
      b.addBuff(e, { key: 'ux:smokeBody', persist: true, flags: { noMove: true, noDisplace: true, unblockable: true, invulnerable: true, healFree: true, isolated: true } });
    },
    tick(b, e, a) {
      clear(b, e, a);
      if (b.time >= a.expire) { b._remove(e, 'expired'); return; }
      if (b.time < a.start || b.time < (e.mem.uniteSmokeDisabledUntil ?? 0)) return;
      if (b.time >= (a.drawAt ?? 0)) {
        a.drawAt = b.time + 1;
        b.fx('telegraph', { x: e.x, y: e.y, kind: 'smoke', tiles: 'box', r: 1, dur: 1.05 });
      }
      a.affected = [...b.allies(), ...b.enemies.filter(u => u.alive && !u.blockedBy)].filter(u => !u.hidden && box(u, e.x, e.y));
      for (const u of a.affected) b.addBuff(u, { key: `ux:smoke:${e.id}`, flags: { stealth: true } });
    },
    death(c, b, e, a) { clear(b, e, a); },
  }];
}
function hanko() {
  return [{ silAware: true,
    spawn(b, e, a) {
      e.profile.deferHit = true; e.profile.extraAttackTargets = visibleTargets;
      a.x = e.x; a.y = e.y; a.dx = -1; a.dy = 0; a.blinkAt = b.time + 2; a.flareAt = b.time;
      for (const pos of b.flags.smokeTiles ?? []) spawnChildren(b, e, SMOKE, 1, { pos, countInTotal: false,
        route: { motion: 'FLY', start: pos, end: pos, steps: [{ t: 'wait', s: 99999 }] } });
    },
    attack(c, b, e) {
      for (const target of c.targets) {
        if (e.blockedBy) b.dealDamage(e, target, { amount: e.s.atk * 2, type: 'phys', isAttack: true });
        else for (let i = 0; i < 2; i++) b.addProjectile({ from: e, target, source: e, visual: 'enemy',
          onHit: ({ target: u }) => { if (u) b.dealDamage(e, u, { amount: e.s.atk, type: 'phys', isAttack: true, isProjectile: true, ignoreSelect: true }); } });
      }
    },
    tick(b, e, a) {
      const dx = e.x-a.x, dy = e.y-a.y, distance = hypot(dx, dy);
      if (distance > 1e-6) { a.dx = dx/distance; a.dy = dy/distance; }
      a.x = e.x; a.y = e.y;
      if (!canCast(e, false, b)) return;
      if (e.blockedBy && !e.s.flags.silence && b.time >= a.blinkAt) {
        a.blinkAt = b.time + 15;
        const x = e.x+a.dx*1.5, y = e.y+a.dy*1.5;
        if (b.grid.groundPassable(Math.round(y), Math.round(x))) blinkTo(b, e, y, x);
        b.addBuff(e, { key: 'ux:hankoBlink', duration: 1, flags: { unblockable: true } });
        a.x = e.x; a.y = e.y;
        return;
      }
      if (b.time < a.flareAt) return;
      const target = byPriority(e, visibleTargets(b, e, e.base.rangeRadius+.25))[0];
      if (!target) return;
      a.flareAt = b.time+15;
      b.addProjectile({ from: e, target, source: e, visual: 'lob', hitDead: true,
        onHit: ({ x, y }) => {
          for (const u of b.allies()) if (box(u, x, y)) hurt(b, e, u, e.s.atk, 'phys', { ignoreSelect: true });
          for (const s of b.enemies) if (s.alive && s.defId === SMOKE && box(s, x, y)) s.mem.uniteSmokeDisabledUntil = b.time+15;
        } });
    },
    death(c, b) { for (const s of b.enemies) if (s.alive && s.defId === SMOKE) b._remove(s, 'expired'); },
  }];
}
export const UNITE_HANKO_KITS = Object.freeze({ enemy_2139_shdbj2: hanko, [SMOKE]: smoke });
