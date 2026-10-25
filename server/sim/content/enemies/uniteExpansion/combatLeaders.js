// Remaining self-contained leader mechanics, sourced from the corresponding PRTS pages (2026-10-14).
import { areaAllies, targetsNear, byPriority, canCast, hurt, expectedFinal, watchDeaths, setForm } from '../helpers.js';
import { noAirTargets, reborn, splashAttack } from '../archetypes.js';
import { LEADER_KITS } from '../leaders.js';
import { aggregateMods } from '../../../buffs.js';
import { summonIceCrystal, avalanche } from './environment.js';

function giant() {
  return [{ cd: 13, left: 13,
    cond(b, e, a) {
      a.target = targetsNear(b, e, 2.5).filter(u => !u.s.flags.stun)
        .sort((x, y) => ((x.x-e.x)*(x.x-e.x)+(x.y-e.y)*(x.y-e.y))-((y.x-e.x)*(y.x-e.x)+(y.y-e.y)*(y.y-e.y)))[0];
      return !!a.target;
    },
    fire(b, e, a) { b.addProjectile({ from: e, target: a.target, source: e, visual: 'lob', speed: 8, onHit: ({ target }) => {
      if (!target) return;
      b.dealDamage(e, target, { amount: e.s.atk * .7, type: 'phys', isAttack: true });
      if (target.alive) b.applyStatus(target, 'stun', { duration: 25, source: e });
    } }); },
  }];
}
function goliath() {
  return [{
    spawn(b, e, a) { e.profile.deferHit = true; a.sp = 0; watchDeaths(b, e); },
    attack(c, b, e, a) {
      const target = c.targets[0]; if (!target) return;
      if (a.sp < 3) { a.sp++; b.dealDamage(e, target, { amount: e.s.atk, type: 'phys', isAttack: true }); return; }
      a.sp = 0; a.target = target; a.seq = target.deploySeq; a.until = b.time + 8; a.interrupted = false;
      b.addBuff(e, { key: 'ux:goliathCharge', duration: 8, flags: { disarm: true, noMove: true } });
      b.fx('telegraph', { id: e.id, x: target.x, y: target.y, dur: 6, kind: 'chargeAttack' });
      b.after(6, () => {
        if (!e.alive || a.interrupted || !canCast(e, false, b) || !target.alive || target.deploySeq !== a.seq) return;
        hurt(b, e, target, e.s.atk * 1.5, 'phys', { canDodge: true });
      });
    },
    tick(b, e, a) { if (a.until > b.time && !canCast(e, false, b)) a.interrupted = true; },
    otherDeath(c, b, e, a) { if (c.unit === a.target && b.time <= a.until) a.sp = 3; },
  }];
}
function sniper() {
  return [{ silAware: true,
    spawn(b, e, a) { e.profile.noAttack = true; a.ammo = 1; a.shootAt = b.time + 5; a.reloadAt = b.time + 8; a.lastShot = -Infinity; },
    tick(b, e, a) {
      if (a.loading != null) {
        if (!canCast(e, true, b) || e.s.flags.disarm) { a.loading = null; b.removeBuff(e, 'ux:reload'); }
        else if (b.time >= a.loading) { a.ammo = 1; a.loading = null; b.removeBuff(e, 'ux:reload'); }
      }
      if (b.time >= a.reloadAt) {
        a.reloadAt += 8;
        if (!a.ammo && a.loading == null && b.time - a.lastShot >= 4 && canCast(e, true, b) && !e.s.flags.disarm) {
          a.loading = b.time + 10; b.addBuff(e, { key: 'ux:reload', duration: 10, flags: { noMove: true } });
        }
      }
      if (!a.ammo || b.time < a.shootAt || !canCast(e, false, b) || e.s.flags.disarm) return;
      const target = byPriority(e, targetsNear(b, e, 99).filter(u => !u.isFlying))[0]; if (!target) return;
      a.ammo = 0; a.lastShot = b.time; a.shootAt = b.time;
      b.addProjectile({ from: e, target, source: e, visual: 'enemy', onHit: ({ target: u }) => {
        if (u) hurt(b, e, u, e.s.atk, 'phys', { canDodge: true });
      } });
      e.mem.uniteAmmo = a.ammo;
    },
  }];
}
function warCaster() {
  const shield = (b, e, a) => { a.shield = true; b.addBuff(e, { key: 'ux:warShield', persist: true, mods: { defPct: .2, resFlat: -20 } }); };
  return [splashAttack({ unblocked: false, radius: 1, dodge: true }), {
    spawn(b, e, a) { a.stolen = 0; shield(b, e, a); },
    hitIn(c, b, e, a) {
      if (!a.shield || !['phys', 'arts'].includes(c.dmg.type)) return;
      if (expectedFinal(c.source, e, c.dmg) < 1200) c.dmg.cancel = true;
      else { a.shield = false; b.removeBuff(e, 'ux:warShield'); b.fx('shieldBreak', { id: e.id, x: e.x, y: e.y }); }
    },
    tick(b, e, a) { if (!a.shield && e.s.flags.leakSource && canCast(e, false, b)) shield(b, e, a); },
    cd: 22, left: 15,
    cond(b, e, a) { a.target = byPriority(e, targetsNear(b, e, e.base.rangeRadius).filter(u => !u.isFlying))[0]; return !!a.target; },
    fire(b, e, a) {
      const target = a.target, seq = target.deploySeq; a.interrupted = false;
      b.addBuff(e, { key: 'ux:focus', duration: 7, flags: { noMove: true, disarm: true },
        onTick: () => { if (!canCast(e, false, b)) a.interrupted = true; } });
      for (let i = 1; i <= 7; i++) b.after(i, () => {
        if (!e.alive || a.interrupted || !target.alive || target.deploySeq !== seq || !canCast(e, false, b)) return;
        if (!(hurt(b, e, target, e.s.atk * .4, 'arts', { tags: ['ux:focus'] }) > 0) || a.stolen >= 2050) return;
        const base = target.base.atk + (aggregateMods(target.buffs).add.atkFlat ?? 0);
        const amount = Math.max(0, Math.min(50, 2050-a.stolen, base-1)); if (!amount) return;
        a.stolen += amount;
        const key = `ux:stolen:${e.id}`, previous = -(target.findBuff(key)?.mods.atkFlat ?? 0);
        b.addBuff(target, { key, persist: true, mods: { atkFlat: -(previous+amount) } });
        b.addBuff(e, { key: 'ux:stolenAtk', persist: true, mods: { atkFlat: a.stolen } });
      });
    },
  }];
}
function coldDisaster() {
  return [noAirTargets(), reborn({ dur: 6.6, invincible: 30, onReborn(b, e) {
    b.addBuff(e, { key: 'ux:coldRebirth', persist: true, mods: { atkPct: .9, hpPct: .5 } });
  } }), {
    spawn(b, e, a, ab) {
      ab.immune = new Set([...(ab.immune ?? []), 'sleep']); watchDeaths(b, e);
      b.addBuff(e, { key: 'ux:coldInitial', duration: 80, flags: { invulnerable: true } });
    },
    dealt(c, b, e) { b.applyStatus(c.target, 'cold', { duration: 5, source: e }); },
    otherDeath(c, b) {
      if (c.unit.side !== 'ally' || !['killed','retreat','merchant'].includes(c.reason)) return;
      if (c.wasFrozen) c.unit.respawnAt = b.time + (c.unit.respawnAt-b.time)*2;
    },
    cd: 12, left: 12,
    fire(b, e) { for (const u of areaAllies(b, e, e.x, e.y, 2.6)) {
      hurt(b, e, u, e.s.atk * (u.s.flags.freeze ? 2.6 : 1.3), 'arts');
      if (u.alive) b.applyStatus(u, 'cold', { duration: 10, source: e });
    } },
  }, {
    cd: 75, left: 75,
    fire(b, e) { for (const pos of b.flags.iceCrystalTiles ?? []) summonIceCrystal(b, e, pos); },
  }];
}
function elk() {
  return [{ cd: 28, left: 0,
    cond(b, e) { return !!e.blockedBy; },
    fire(b, e, a) {
      const target=e.blockedBy, seq=target.deploySeq; a.interrupted=false; a.until=b.time+8; a.success=false;
      b.addBuff(e,{key:'ux:elkCharge',duration:8,flags:{disarm:true,noMove:true}});
      b.after(6.6,()=>{
        if(!e.alive||a.interrupted||!canCast(e,false,b)||!target.alive||target.deploySeq!==seq)return;
        hurt(b,e,target,e.s.atk,'phys',{canDodge:true});a.success=true;
        avalanche(b,e,target);
      });
      b.after(8,()=>{
        if(!e.alive||a.success)return;
        const duration=e.s.flags.stun||e.s.flags.sleep?4:5;
        b.addBuff(e,{key:'ux:elkFailure',duration,flags:{disarm:true,noMove:true},onExpire:()=>setForm(b,e,'revived')});setForm(b,e,'failed');
      });
    },
    tick(b,e,a){if(a.until>b.time&&!canCast(e,false,b))a.interrupted=true;},
  }];
}
export const UNITE_COMBAT_LEADER_KITS = Object.freeze({
  enemy_1513_dekght: LEADER_KITS.enemy_1513_dekght,
  enemy_1513_dekght_2: LEADER_KITS.enemy_1513_dekght_2,
  enemy_2004_balloon: (ab,e,b) => [...LEADER_KITS.enemy_2004_balloon(ab,e,b), {
    tick(battle, enemy) { enemy.profile.noAttack = !!enemy.s.flags.float; },
  }],
  enemy_2003_rockman: giant, enemy_2074_skzgly: goliath, enemy_10088_hlsnip_2: sniper,
  enemy_10210_muwiz: warCaster, enemy_2007_flwitch: coldDisaster, enemy_10144_xdelk: elk,
});
