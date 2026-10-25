// PRTS 接潮主教 / 接潮蔑死体 / 接潮斥亡体, checked 2026-10-14.
// A knock-out is not a kill: bounty and kill layers wait until both halves are down.
import { elem, watchDeaths, setForm } from '../helpers.js';

const PRIEST = 'enemy_2028_syevil';
const BODIES = new Set(['enemy_2029_symon', 'enemy_2030_symon2']);
const opposite = (e, o) => (e.defId === PRIEST ? BODIES.has(o.defId) : o.defId === PRIEST)
  && (e.mods?.unitePairId ?? null) === (o.mods?.unitePairId ?? null);
const stateOf = e => e.mem.uniteTide;

function finishTogether(b, units) {
  // Mark every half first, so recursive death notifications cannot revive the second one.
  for (const e of units) stateOf(e).terminal = true;
  for (const e of units) b.kill(e, stateOf(e).killer);
}

function tide(rate, erosion) {
  return [{
    spawn(b, e, a) { e.mem.uniteTide = a; a.phase = 'normal'; watchDeaths(b, e); },
    dealt(c, b, e) { if (erosion) elem(b, e, c.target, 'erosion', e.s.atk * .5); },
    killed(c, b, e, a) {
      if (a.terminal || a.partnerGone || e.mods?.unitePairTerminal) return false;
      if (a.phase !== 'normal') { e.hp = Math.max(1, e.s.maxHp * .02); return true; }
      a.killer = c.killer; a.phase = 'reborn'; a.healClock = 0; a.noAttack = e.profile.noAttack;
      for (const buff of e.buffs.slice()) if (!buff.persist && (buff.source || buff.status)) b.removeBuff(e, buff);
      e.hp = 1; e.profile.noAttack = true; e.unbalanceUntil = -Infinity;
      b.addBuff(e, { key: 'ux:tideDown', persist: true,
        flags: { invulnerable: true, unblockable: true, noMove: true, noDisplace: true } });
      b._unblock(e); setForm(b, e, 'reborn');
      b.after(.1, () => {
        if (!e.alive || a.terminal) return;
        e.hp = e.s.maxHp * .02; a.phase = 'down'; setForm(b, e, 'husk');
        const partners = b.enemies.filter(o => o.alive && opposite(e, o) && stateOf(o)?.phase === 'down');
        if (partners.length) finishTogether(b, [e, ...partners]);
      });
      return true;
    },
    tick(b, e, a, dt) {
      if (a.phase !== 'down') return;
      a.healClock += dt;
      if (a.healClock < 1 - 1e-9) return;
      a.healClock -= 1;
      b.heal(e, e, e.s.maxHp * rate);
      if (e.hp < e.s.maxHp) return;
      a.phase = 'normal'; b.removeBuff(e, 'ux:tideDown'); e.profile.noAttack = a.noAttack;
      e.atkCd = 0; if (e.route) e.route.pts = null; setForm(b, e, 'revived');
    },
    otherDeath(c, b, e, a) {
      if (c.reason === 'leak' && opposite(e, c.unit)) {
        a.partnerGone = true;
        if (a.phase === 'down') finishTogether(b, [e]);
      }
    },
  }];
}

export const UNITE_TIDE_KITS = Object.freeze({
  [PRIEST]: () => tide(.05, false),
  enemy_2029_symon: () => tide(.05, true),
  enemy_2030_symon2: () => tide(.1, true),
});
