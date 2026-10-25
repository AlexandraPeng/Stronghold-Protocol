// PRTS 小帽子 / 大披风 / 浮空信件 / 欢乐校车 / 庆典校车 / 炙烤螺旋桨 / 行天卫生间.
import { canCast, spawnChildren, stayRoute, remainingRoute, elem, setForm } from '../helpers.js';
import { setFloat, noAirTargets, reborn } from '../archetypes.js';
import { compileRoute } from '../../../ai.js';
import { normalizeRoute } from '../../../simdata.js';

const LETTER = 'enemy_10231_agpack';
const BUS = new Set(['enemy_10225_agpbus', 'enemy_10225_agpbus_2']);
export function replaceRoute(b, e, route) {
  e.route = { legs: compileRoute(normalizeRoute(route), b.rect), legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
}
function courier() {
  return [noAirTargets(), {
    spawn(b, e, a) { e.def = { ...e.def, staticBody: true }; a.carrying = !!e.mods?.carryingLetter; },
    cd: 30, left: 0,
    cond(b, e, a) {
      if (a.carrying) return false;
      a.letter = b.enemiesInRadius(e.x, e.y, e.base.rangeRadius).find(o => o.defId === LETTER && !o.hidden);
      return !!a.letter;
    },
    fire(b, e, a) { b.kill(a.letter); if (!a.letter.alive) { a.carrying = true; setForm(b, e, 'carrying'); } },
    death(c, b, e, a) {
      if (a.carrying && c.reason === 'killed') spawnChildren(b, e, LETTER, 1, {
        pos: [Math.round(e.y), Math.round(e.x)], route: stayRoute(e), countInTotal: false,
      });
    },
  }];
}
function letter() {
  const hit = (c, b, e, a) => {
    c.dmg.cancel = true;
    const source = c.source;
    if (e.hidden || e.s.flags.invulnerable || !source?.alive || !source.deployed || source.side !== 'ally'
      || (Math.round(source.y) === Math.round(e.y) && Math.round(source.x) === Math.round(e.x))) return;
    a.sp++; e.mem.uniteLetterSp = a.sp;
    if (a.sp < 5) return;
    a.sp = 0; e.mem.uniteLetterSp = 0; e.x = source.tileC; e.y = source.tileR;
    replaceRoute(b, e, stayRoute(e));
    b.addBuff(e, { key: 'ux:letterInvincible', duration: 1, flags: { invulnerable: true } });
    b.fx('blink', { id: e.id, x: e.x, y: e.y });
  };
  return [{
    spawn(b, e, a, ab) {
      e.def = { ...e.def, staticBody: true }; e.profile.noAttack = true; e.counted = false; e.mem.nonPrimary = true;
      a.sp = 0; ab.immune = new Set([...(ab.immune ?? []), 'stun', 'freeze', 'cold', 'sleep']);
      b.addBuff(e, { key: 'ux:letter', persist: true, flags: { unblockable: true } });
      b.on('elementHit', c => { if (c.target === e) hit(c, b, e, a); }, { owner: e, priority: -500 });
    },
    hitIn: hit,
  }];
}
function bus() {
  return [{
    spawn(b, e, a) { setFloat(b, e, true); e.profile.noAttack = true; a.passengers = []; },
    tick(b, e, a) {
      if (a.passengers.length >= 2 || !canCast(e, false, b)) return;
      const candidates = b.enemiesInRadius(e.x, e.y, .5).filter(o => o !== e && !o.hidden && !o.isFlying && !o.isBoss
        && !BUS.has(o.defId) && !o.def.tags.includes('machine'));
      for (const o of candidates) {
        if (a.passengers.length >= 2) break;
        a.passengers.push(o); b._setHidden(o, true); o.mem.uniteCarrier = e;
        replaceRoute(b, o, stayRoute(o));
      }
    },
    death(c, b, e, a) {
      const route = remainingRoute(e);
      // Skip the current waiting checkpoint when unloading (PRTS 特殊机制 / 载客).
      if (route.steps?.[0]?.t === 'wait') route.steps.shift();
      for (const o of a.passengers) {
        if (!o.alive) continue;
        o.x = e.x + (b.rng() - .5) * .4; o.y = e.y + (b.rng() - .5) * .4;
        delete o.mem.uniteCarrier; replaceRoute(b, o, route); b._setHidden(o, false);
      }
      a.passengers = [];
    },
  }];
}

// Event terrain reads contributions by unit identity; contributions disappear on death or movement out of the region.
export function buoyancyAt(b, row, col) {
  let value = 0;
  for (const e of b.enemies) if (e.alive && !e.hidden && e.mem.uniteBuoyancy && Math.round(e.y) === row && Math.round(e.x) === col) value += e.mem.uniteBuoyancy;
  return value;
}
function propeller() {
  return [{ silAware: true,
    spawn(b, e, a) { e.def = { ...e.def, staticBody: true }; e.mem.uniteBuoyancy = 1; a.clock = 0; },
    tick(b, e, a, dt) {
      a.clock += dt; if (a.clock < 1 - 1e-9) return; a.clock -= 1;
      if (e.hidden || e.s.flags.silence) return;
      const units = [...b.enemiesInRadius(e.x, e.y, 2), ...b.alliesInRadius(e.x, e.y, 2)];
      for (const u of units) {
        if (['enemy_10150_nsheat', 'enemy_10150_nsheat_2'].includes(u.defId)) continue;
        if (b.time < (u.mem.uniteHeatAt ?? -Infinity) + 1 - 1e-9) continue;
        u.mem.uniteHeatAt = b.time; elem(b, e, u, 'burn', e.s.atk * .1, { ignoreSelect: true });
      }
    },
  }];
}
function toilet() {
  return [{ spawn(b, e) { e.def = { ...e.def, staticBody: true }; } }, reborn({
    onKo(b, e, a) {
      a.passable = b.grid.groundPassable(Math.round(e.y), Math.round(e.x));
      if (!a.passable) return;
      e.mem.nonPrimary = true;
      if (e.inTotal) { b.killedInTotal++; const pp = b._pp(e.ownerId); if (pp) pp.killedInTotal++; e.inTotal = false; }
    },
    onReborn(b, e, a) {
      e.motion = 'WALK'; e.counted = false; e.mem.uniteBuoyancy = -1;
      e.profile.noAttack = true;
      b.addBuff(e, { key: 'ux:wreck', persist: true, mods: { defPct: 1 }, flags: { noMove: true, disarm: true, unblockable: true } });
      if (e.route) e.route.pts = null;
      if (!a.passable) b.after(0, () => { if (e.alive) b._remove(e, 'expired'); });
    },
  })];
}
export const UNITE_FLY_KITS = Object.freeze({
  enemy_10224_agmess: courier, enemy_10224_agmess_2: courier, [LETTER]: letter,
  enemy_10225_agpbus: bus, enemy_10225_agpbus_2: bus,
  enemy_10150_nsheat: propeller, enemy_10151_nspace: toilet,
});
