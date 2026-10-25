// PRTS 炭长矛 / 玉双剑 / 昭烈君 / 枣大刀 / 文衡君, checked 2026-10-14.
import { RESIST_STATUSES } from '../../../buffs.js';
import { areaAllies, hurt, setForm, canCast } from '../helpers.js';
import { powi } from '../../../detmath.js';

const KEYS = new Set(['enemy_2110_dyyrzf', 'enemy_2111_dyyrz2', 'enemy_2112_dyhlgy',
  'enemy_2113_dyhlg2', 'enemy_2114_dylbgg', 'enemy_2115_dylbg2']);
const normal = e => e.alive && !e.hidden && e.mem.uniteKnight?.phase === 'normal';
const members = b => b.enemies.filter(e => KEYS.has(e.defId) && normal(e));
const hasLeader = e => !!e.s.flags.uniteKnightLeader;

function statue(seconds) {
  return {
    spawn(b, e, a) {
      e.mem.uniteKnight = a; a.phase = 'statue'; a.noAttack = e.profile.noAttack; e.profile.noAttack = true;
      b.addBuff(e, { key: 'ux:statue', persist: true, flags: {
        untargetable: true, invulnerable: true, stealth: true, immortal: true, noMove: true, unblockable: true,
      } });
      b.on('beforeStatus', c => {
        if (c.target !== e) return;
        if (a.phase === 'statue' && ['sleep', 'closed'].includes(c.status)) c.cancel = true;
        if (e.findBuff('ux:perfectResist') && RESIST_STATUSES.has(c.status)) c.cancel = true;
      }, { owner: e });
      setForm(b, e, 'stone');
      b.after(seconds, () => {
        if (!e.alive) return;
        a.phase = 'normal'; b.removeBuff(e, 'ux:statue'); e.profile.noAttack = a.noAttack;
        setForm(b, e, 'revived');
      });
    },
    killed(c, b, e, a) { if (a.phase !== 'statue') return false; e.hp = 1; return true; },
  };
}

function spear() {
  const apply = (b, e, a) => {
    const target = normal(e) ? e.blockedBy : null;
    if (a.blocker && a.blocker !== target) b.removeBuff(a.blocker, `ux:spear:${e.id}`);
    a.blocker = target;
    if (!target) { b.removeBuff(e, 'ux:spearSelf'); return; }
    b.addBuff(e, { key: 'ux:spearSelf', persist: true, mods: { physTakenMul: 1.5, artsTakenMul: 1.5 } });
    const v = hasLeader(e) ? 2 : 1.5;
    b.addBuff(target, { key: `ux:spear:${e.id}`, persist: true, mods: { physTakenMul: v, artsTakenMul: v } });
  };
  return [statue(75), {
    tick: apply, blocked(c, b, e, a) { apply(b, e, a); },
    death(c, b, e, a) { if (a.blocker) b.removeBuff(a.blocker, `ux:spear:${e.id}`); },
  }];
}

function leader(cd) {
  const clear = (b, e, a) => {
    for (const o of a.guards ?? []) b.removeBuff(o, `ux:leader:${e.id}`);
    a.guards = []; b.removeBuff(e, 'ux:guards');
  };
  return [statue(50), {
    iv: .1,
    spawn(b, e, a) { a.guards = []; a.healCd = cd; },
    tick(b, e, a) {
      clear(b, e, a); if (!normal(e)) return;
      a.guards = members(b).filter(o => o !== e);
      for (const o of a.guards) b.addBuff(o, { key: `ux:leader:${e.id}`, persist: true, flags: { uniteKnightLeader: true } });
      const scale = powi(.6, a.guards.length);
      b.addBuff(e, { key: 'ux:guards', persist: true, mods: { physTakenMul: scale, artsTakenMul: scale } });
      // The cooldown belongs to normal form, so 50 s spent as a statue cannot charge it.
      a.healCd -= .1;
      if (a.healCd > 1e-9 || e.blockedBy || !canCast(e, true, b)) return;
      const target = members(b).filter(o => o.hp < o.s.maxHp).sort((x, y) => x.hpRatio - y.hpRatio)[0];
      if (!target) return;
      a.healCd = cd; b.heal(e, target, e.s.atk * 5);
      for (const buff of target.buffs.slice()) if (RESIST_STATUSES.has(buff.status)) b.removeBuff(target, buff);
      b.addBuff(target, { key: 'ux:perfectResist', duration: 1 });
    },
    death(c, b, e, a) { clear(b, e, a); },
  }];
}

function wind(wake, pauseOnControl) {
  return [statue(wake), {
    spawn(b, e, a) { a.cooldown = 0; a.damageClock = 0; },
    tick(b, e, a, dt) {
      const s = e.mem.uniteKnight;
      if (s.phase === 'statue') return;
      if (s.phase === 'normal') {
        a.cooldown = Math.max(0, a.cooldown - dt);
        if (a.cooldown > 0 || !e.blockedBy || !canCast(e, true, b)) return;
        s.phase = 'wind'; a.until = b.time + (hasLeader(e) ? 4 : 2); a.damageClock = 0;
        e.profile.noAttack = true; b._unblock(e);
        b.addBuff(e, { key: 'ux:wind', persist: true, flags: { unblockable: true }, mods: { moveMul: 3 } });
        setForm(b, e, 'wind');
      }
      if (s.phase !== 'wind') return;
      if (b.time >= a.until && canCast(e, true, b)) {
        s.phase = 'normal'; a.cooldown = 20; b.removeBuff(e, 'ux:wind'); e.profile.noAttack = s.noAttack;
        setForm(b, e, 'revived'); return;
      }
      a.damageClock += dt;
      if (a.damageClock < 1 - 1e-9) return;
      a.damageClock -= 1;
      if (pauseOnControl && (e.s.flags.stun || e.s.flags.sleep)) return;
      for (const target of areaAllies(b, e, e.x, e.y, 1.2)) hurt(b, e, target, e.s.atk * .8, 'phys', { isSkill: false });
    },
  }];
}
export const UNITE_KNIGHT_KITS = Object.freeze({
  enemy_2110_dyyrzf: spear,
  enemy_2114_dylbgg: () => leader(15),
  enemy_2115_dylbg2: () => leader(20),
  enemy_2112_dyhlgy: () => wind(105, true),
  enemy_2113_dyhlg2: () => wind(30, false),
});
