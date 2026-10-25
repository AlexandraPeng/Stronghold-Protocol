// Shared operator locking for 似兽 / 沉眠伴随兽. Lock before knock-out hooks, so auto-redeploy effects cannot duplicate a passenger.
import { setFloat } from '../archetypes.js';
import { canCast, elem, watchDeaths, remainingRoute, stayRoute, setForm } from '../helpers.js';
import { replaceRoute } from './flying.js';

export function captureOperator(b, e, u, alreadyDead = false) {
  if (!u || u.kind !== 'op' || u.mem.uniteCapture || u.s.flags.devourImmune || (!alreadyDead && !u.alive)) return null;
  const record = { unit: u, hp: u.hpRatio, sp: u.skill?.spTotal ?? 0, dir: u.dir, block: u.s.blockCnt };
  u.mem.uniteCapture = e;
  if (!alreadyDead) {
    b.kill(u, e);
    // Forced knock-out still wins over a death-prevention handler that left HP positive.
    if (u.alive) b._remove(u, 'killed', e);
  }
  u.respawnAt = Infinity; u.body = null;
  return record;
}
export function releaseOperator(b, e, record, { deploy = false, restore = false, stun = 0 } = {}) {
  if (!record) return false;
  const u = record.unit;
  if (u.mem.uniteCapture !== e) return false;
  delete u.mem.uniteCapture; u.respawnAt = b.time; u.dir = record.dir;
  if (!deploy) return false;
  const tile = [Math.round(e.y), Math.round(e.x)];
  const ranged = u.def.position === 'RANGED' || u.profile?.ranged;
  if (!b.grid.canStand(tile[0], tile[1], { ranged: !!ranged }) || !b.redeploy(u, { tile, free: true })) return false;
  if (restore) {
    u.hp = Math.max(1, Math.min(u.s.maxHp, u.s.maxHp * record.hp));
    if (u.skill && !u.skill.noSkill) u.skill.setSpTotal(record.sp);
  }
  if (stun > 0) b.applyStatus(u, 'stun', { duration: stun, source: e });
  return true;
}
function devourer() {
  return [{
    spawn(b, e) { e.profile.melee = true; },
    cd: 1, left: 0,
    cond(b, e, a) { return !a.full && !!e.blockedBy; },
    fire(b, e, a) {
      const target = e.blockedBy;
      if (!target.s.flags.devourImmune) {
        if (target.kind === 'op') a.record = captureOperator(b, e, target);
        else b.kill(target, e);
      }
      if (target.alive) b.dealDamage(e, target, { amount: e.s.atk, type: 'phys', isAttack: true });
      a.full = true; setFloat(b, e, true);
      b.addBuff(e, { key: 'ux:devoured', persist: true, mods: { defFlat: -1500 } }); setForm(b, e, 'full');
    },
    death(c, b, e, a) { releaseOperator(b, e, a.record, { deploy: c.reason === 'killed' }); },
  }];
}
function companion() {
  const unload = (b, e, a, death = false) => {
    if (a.record) releaseOperator(b, e, a.record, { deploy: !death, restore: true, stun: 3 });
    const passenger = a.enemy;
    if (passenger?.alive) {
      passenger.x = e.x + (b.rng() - .5) * .4; passenger.y = e.y + (b.rng() - .5) * .4;
      replaceRoute(b, passenger, remainingRoute(e)); delete passenger.mem.uniteCarrier; b._setHidden(passenger, false);
    }
    a.record = null; a.enemy = null; a.readyAt = b.time + 10; e.blockWeight = a.block; e.lpr = a.lpr;
    b.removeBuff(e, 'ux:companion'); setForm(b, e, 'revived');
  };
  const start = (b, e, a) => {
    e.blockWeight = a.block + (a.record?.block ?? a.enemy?.blockWeight ?? 0); e.lpr = a.lpr + 1;
    a.until = b.time + (a.record ? 3 : 3.2);
    b.addBuff(e, { key: 'ux:companion', persist: true, mods: { moveFlat: 1 } }); setForm(b, e, 'carrying');
  };
  return [{
    spawn(b, e, a) { a.readyAt = 0; a.block = e.blockWeight; a.lpr = e.lpr; watchDeaths(b, e); a.hitWindow = new Map(); },
    hitOut(c, b, e, a) {
      if (c.dmg.isAttack && c.target.kind === 'op') a.hitWindow.set(c.target, { until: b.time + .1, hp: c.target.hpRatio, sp: c.target.skill?.spTotal ?? 0 });
    },
    dealt(c, b, e) { elem(b, e, c.target, 'neural', e.s.atk * 1.5); },
    otherDeath(c, b, e, a) {
      const record = a.hitWindow.get(c.unit);
      if (!record || record.until < b.time || a.record || a.enemy || b.time < a.readyAt || c.reason !== 'killed') return;
      a.record = captureOperator(b, e, c.unit, true);
      if (a.record) { Object.assign(a.record, { hp: record.hp, sp: record.sp }); start(b, e, a); }
    },
    tick(b, e, a) {
      for (const [u, record] of a.hitWindow) if (record.until < b.time) a.hitWindow.delete(u);
      if (a.record || a.enemy) {
        if (b.time >= a.until || e.s.flags.stun || e.s.flags.freeze) unload(b, e, a);
        return;
      }
      if (b.time < a.readyAt || !canCast(e, false, b)) return;
      const target = b.alliesInRadius(e.x, e.y, .25).find(u => u.kind === 'op' && !u.isFlying && u.s.flags.stun && !u.mem.uniteCapture);
      if (target) { a.record = captureOperator(b, e, target); if (a.record) start(b, e, a); return; }
      const enemy = b.enemiesInRadius(e.x, e.y, .25).find(o => o !== e && !o.hidden && !o.isFlying && o.s.flags.dreamDormant && !o.mem.uniteCarrier);
      if (enemy) {
        a.enemy = enemy; enemy.mem.uniteCarrier = e; b._setHidden(enemy, true); replaceRoute(b, enemy, stayRoute(enemy)); start(b, e, a);
      }
    },
    death(c, b, e, a) { unload(b, e, a, true); },
  }];
}
export const UNITE_CAPTURE_KITS = Object.freeze({ enemy_2105_dyrnge: devourer, enemy_10107_mjcdog_2: companion });
