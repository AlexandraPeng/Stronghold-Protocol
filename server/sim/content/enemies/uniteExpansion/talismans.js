// PRTS 便符 / 受符 / 皮书生 / 平剑客 / 靳天师 (2026-10-14).
import { areaAllies, allTargets, byPriority, canCast, hurt, spawnChildren, hitCount, setHits, setForm } from '../helpers.js';
const PAPER = 'enemy_2101_dyspll', SEAL = 'enemy_2121_dyspl2';
const live = u => u?.alive && u.deployed && !u.hidden;
export const isSealed = u => !!u.s.flags.uniteSeal;

export function sealTarget(b, e, target, ratio = 1) {
  if (!live(target) || isSealed(target)) return null;
  const pos = [target.tileR, target.tileC];
  const child = spawnChildren(b, e, SEAL, 1, { pos, route: { motion: 'WALK', start: pos, end: pos, steps: [{ t: 'wait', s: 99999 }] }, countInTotal: false })[0];
  if (child) child.hp = Math.max(1, child.s.maxHp * ratio);
  return child;
}

function paper() {
  return [{
    spawn(b, e) {
      e.def = { ...e.def, staticBody: true }; e.counted = false; e.mem.nonPrimary = true;
      // The Wiki's special HP is a fixed hit count, not round-scaled ordinary HP.
      setHits(e, e.def.maxHp); hitCount(b, e, true);
      b.addBuff(e, { key: 'ux:paper', persist: true, flags: { unblockable: true } });
      e.profile.canTarget = u => !isSealed(u);
    },
    dealt(c, b, e) {
      if (!live(e) || !canCast(e, false, b)) return;
      sealTarget(b, e, c.target, e.hpRatio); b.kill(e);
    },
    attack(c, b, e) { b.after(.1, () => { if (live(e) && canCast(e, false, b)) b.kill(e); }); },
  }];
}

function attachedPaper() {
  const detach = (b, e, a) => {
    for (const u of a.sealed ?? []) b.removeBuff(u, `ux:seal:${e.id}`);
    a.sealed = [];
    if (a.attached?.mem.uniteAttachedPaper === e) delete a.attached.mem.uniteAttachedPaper;
    a.attached = null;
  };
  return [{
    spawn(b, e, a) {
      e.def = { ...e.def, staticBody: true }; e.profile.noAttack = true; e.counted = false; e.mem.nonPrimary = true;
      setHits(e, e.def.maxHp); hitCount(b, e, true); a.sealed = []; a.clock = 0;
      b.addBuff(e, { key: 'ux:attachedPaper', persist: true, flags: { noMove: true, unblockable: true, noDisplace: true, teleportImmune: true } });
    },
    tick(b, e, a, dt) {
      if (!live(e)) { detach(b, e, a); return; }
      const eligible = areaAllies(b, e, e.x, e.y, 1).filter(u => Math.abs(u.x - e.x) <= .5 && Math.abs(u.y - e.y) <= .5
        && (!u.mem.uniteAttachedPaper || u.mem.uniteAttachedPaper === e));
      if (!eligible.includes(a.attached)) {
        detach(b, e, a); a.attached = byPriority(e, eligible)[0];
        if (a.attached) a.attached.mem.uniteAttachedPaper = e;
      }
      if (!a.attached) { b.kill(e); return; }
      // Radius zero uses the operator collider (0.25), while attachment is a one-tile square.
      const touching = areaAllies(b, e, e.x, e.y, .25);
      for (const old of a.sealed) if (!touching.includes(old)) b.removeBuff(old, `ux:seal:${e.id}`);
      a.sealed = touching;
      for (const u of touching) b.addBuff(u, { key: `ux:seal:${e.id}`, persist: true, flags: { uniteSeal: true, silence: true } });
      a.clock += dt;
      if (a.clock < 1 - 1e-9) return;
      a.clock -= 1;
      for (const u of touching) hurt(b, e, u, e.s.atk, 'arts', { isSkill: false, tags: ['ux:sealDot'] });
    },
    death(c, b, e, a) { detach(b, e, a); },
  }];
}

function scholar() {
  return [{ tick(b, e, a) {
    if (!a.used && e.hpRatio <= .4) { a.used = true; a.absorbing = true; setForm(b, e, 'absorb'); }
    if (!a.absorbing || !canCast(e, false, b)) return;
    const paper = b.enemiesInRadius(e.x, e.y, 1.5).find(o => o.defId === PAPER && o.isFlying && !o.hidden);
    if (!paper) return;
    b.kill(paper);
    if (!paper.alive) { b.heal(e, e, e.s.maxHp * .6); a.absorbing = false; setForm(b, e, 'revived'); }
  } }];
}

function swordsman() {
  return [{
    spawn(b, e, a) { a.ammo = 3; e.mem.uniteTalismanAmmo = 3; },
    dealt(c, b, e, a) {
      const target = c.target, seq = target.deploySeq;
      if (a.ammo < 1) return;
      b.after(1.01, () => {
        if (!live(e) || !live(target) || target.deploySeq !== seq || a.ammo < 1 || isSealed(target)) return;
        if (sealTarget(b, e, target)) { a.ammo--; e.mem.uniteTalismanAmmo = a.ammo; b.fx('phase', { id: e.id, x: e.x, y: e.y, kind: 'talismanAmmo', value: a.ammo }); }
      });
    },
  }];
}

function master() {
  return [{
    spawn(b, e) { e.profile.noAttack = true; },
    cd: 22, left: 20,
    cond(b, e, a) { const ts = byPriority(e, allTargets(b, e)); a.target = ts.find(u => !isSealed(u)) ?? ts[0]; return !!a.target; },
    fire(b, e, a) {
      const target = a.target, pos = [target.tileR, target.tileC];
      hurt(b, e, target, e.s.atk, 'arts', { canDodge: true });
      if (isSealed(target)) return;
      const route = { motion: 'FLY', start: [Math.round(e.y), Math.round(e.x)], end: pos,
        steps: [{ t: 'move', p: pos }, { t: 'wait', s: 99999 }] };
      const child = spawnChildren(b, e, PAPER, 1, { pos: route.start, route, countInTotal: false })[0];
      if (child) b.addBuff(child, { key: 'ux:paperHaste', duration: 2, mods: { moveMul: 2 } });
      b.addBuff(e, { key: 'ux:paperCast', duration: 2, flags: { noMove: true } });
    },
  }];
}
export const UNITE_TALISMAN_KITS = Object.freeze({
  [PAPER]: paper, [SEAL]: attachedPaper, enemy_2102_dytmbr: scholar,
  enemy_2103_dykens: swordsman, enemy_2104_dycast: master,
});
