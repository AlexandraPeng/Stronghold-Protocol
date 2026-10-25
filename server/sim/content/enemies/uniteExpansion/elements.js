// PRTS 颂水贤者 / 聆风猎手 / 撼地遗众 / 猎犬proto (2026-10-14).
import { COLS } from '../../../constants.js';
import { elem, hurt, areaAllies, targetsNear, byPriority, canCast } from '../helpers.js';
import { noAirTargets } from '../archetypes.js';

export function blinkTo(b, e, row, col, protect = true) {
  const from = [e.y, e.x]; b._unblock(e); e.x = col; e.y = row;
  if (e.route) e.route.pts = null;
  if (protect) b.addBuff(e, { key: 'ab:blink', duration: 1, flags: { invulnerable: true, unblockable: true } });
  b.fx('blink', { id: e.id, x: col, y: row, fx: from[1], fy: from[0] });
}
function water() {
  return [{
    spawn(b, e, a) { a.readyAt = 0; a.x = e.x; a.y = e.y; a.dx = -1; a.dy = 0; },
    tick(b, e, a) {
      const dx = e.x - a.x, dy = e.y - a.y;
      if (Math.abs(dx) + Math.abs(dy) > 1e-6) { a.dx = Math.sign(dx); a.dy = Math.sign(dy); }
      a.x = e.x; a.y = e.y;
    },
    dealt(c, b, e) { elem(b, e, c.target, 'mania', e.s.atk * .25); },
    taken(c, b, e, a) {
      if (b.time < a.readyAt || !canCast(e, false, b)) return;
      const r = Math.round(e.y), col = Math.round(e.x), field = b.grid.flowField(r, col);
      for (const n of [2, 1]) {
        const rr = r - a.dy * n, cc = col - a.dx * n;
        if (!b.grid.groundPassable(rr, cc) || field.dist[rr * COLS + cc] < 0) continue;
        a.readyAt = b.time + 10; blinkTo(b, e, rr, cc); a.x = e.x; a.y = e.y; break;
      }
    },
  }];
}
function hunter() {
  return [noAirTargets(), {
    spawn(b, e, a) { a.readyAt = 0; e.profile.deferHit = true; },
    attack(c, b, e) { for (const target of c.targets) b.dealDamage(e, target, { amount: e.s.atk, type: 'phys', isAttack: true, isProjectile: false }); },
    taken(c, b, e, a) {
      const source = c.source;
      if (e.blockedBy || b.time < a.readyAt || !source || !canCast(e, false, b)) return;
      const goal = e.route?.legs?.findLast(l => l.final);
      if (!goal) return;
      const field = b.grid.flowField(goal.r, goal.c), choices = [], row = Math.round(source.y), col = Math.round(source.x);
      for (let r = row - 1; r <= row + 1; r++) for (let cc = col - 1; cc <= col + 1; cc++) {
        if (!b.grid.groundPassable(r, cc) || (r === Math.round(e.y) && cc === Math.round(e.x))
          || b.grid.tile(r, cc).special === 'end' || field.dist[r * COLS + cc] < 0) continue;
        choices.push({ r, c: cc, d: (r - e.y) * (r - e.y) + (cc - e.x) * (cc - e.x) });
      }
      choices.sort((x, y) => x.d - y.d || x.r - y.r || x.c - y.c);
      if (!choices.length) return;
      a.readyAt = b.time + 30; blinkTo(b, e, choices[0].r, choices[0].c);
    },
  }];
}
function earth() {
  return [{
    spawn(b, e, a) { e.blockWeight = 4; e.profile.melee = true; a.hits = 0; a.layers = 0; a.clock = 0; a.tile = null; },
    taken(c, b, e, a) {
      if (!(c.amount > 0) || c.dmg.tags?.includes('ux:earthBleed')) return;
      if (++a.hits % 10 === 0) { a.layers = Math.min(10, a.layers + 1); b.fx('phase', { id: e.id, x: e.x, y: e.y, kind: 'earthBleed', value: a.layers }); }
    },
    tick(b, e, a, dt) {
      const tile = Math.round(e.y) * COLS + Math.round(e.x);
      if (!e.hidden && tile !== a.tile) {
        a.tile = tile; const atk = e.s.atk;
        for (const u of areaAllies(b, e, e.x, e.y, 1.7)) if (!u.isFlying) hurt(b, e, u, atk * .5, 'phys', { isSkill: false });
      }
      a.clock += dt; if (a.clock < 1 - 1e-9) return; a.clock -= 1;
      if (a.layers) b.dealDamage(null, e, { amount: 300 * a.layers, type: 'true', sourceless: true, canDodge: false, tags: ['ux:earthBleed'] });
    },
  }];
}
const DOG_IMMUNE = ['stun', 'freeze', 'disarm', 'cold', 'fear', 'attract', 'sleep'];
function dog() {
  return [{
    spawn(b, e) { e.profile.melee = true; },
    dealt(c, b, e) { elem(b, e, c.target, 'mania', e.s.atk * .3); },
    cd: 50, left: 15,
    cond(b, e, a) { a.target = byPriority(e, targetsNear(b, e, 2).filter(u => !u.isFlying))[0]; return !!a.target; },
    fire(b, e, a) {
      const ab = e.mem.ab;
      const target = a.target, seq = target.deploySeq, row = Math.round(e.y), col = Math.round(e.x);
      const oldImmune = ab.immune; ab.immune = new Set([...(oldImmune ?? []), ...DOG_IMMUNE]);
      const noAttack = e.profile.noAttack; e.profile.noAttack = true; blinkTo(b, e, target.tileR, target.tileC, false);
      b.addBuff(e, { key: 'ux:dogBite', duration: 10, flags: { noMove: true, noDisplace: true, unblockable: true, teleportImmune: true } });
      for (let i = 1; i <= 10; i++) b.after(i, () => {
        if (!e.alive || !target.alive || target.deploySeq !== seq) return;
        b.dealDamage(e, target, { amount: e.s.atk, type: 'arts', isAttack: true, canDodge: true, tags: ['ux:dogBite'] });
        if (target.alive) b.addBuff(target, { key: 'ux:dogAccuracy', duration: 1.5, mods: { accuracyPhysMul: .2, accuracyArtsMul: .2 } });
      });
      b.after(10, () => {
        if (!e.alive) return;
        b.removeBuff(e, 'ux:dogBite'); ab.immune = oldImmune; e.profile.noAttack = noAttack;
        blinkTo(b, e, row, col, false);
      });
    },
  }];
}
export const UNITE_ELEMENT_KITS = Object.freeze({
  enemy_2134_shrshep: water, enemy_2135_shkrbt: hunter, enemy_2136_shcolo: earth, enemy_2137_shsdgo: dog,
});
