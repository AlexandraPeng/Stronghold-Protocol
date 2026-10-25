// PRTS “剧作家”: the two form-bound skill clocks pause while their form is inactive.
import { COLS } from '../../../constants.js';
import { allTargets, byPriority, canCast, areaAlliesInTiles } from '../helpers.js';
export function sealGround(b, row, col) {
  if (!b.grid.inRect(row, col)) return;
  (b._uniteSealedTiles ??= new Set()).add(row * COLS + col);
  b.fx('telegraph', { x: col, y: row, kind: 'sealedGround', dur: 99999 });
}
function cross(b, e, row, col, scale) {
  for (const u of areaAlliesInTiles(b, e, row, col)) b.dealDamage(e, u, {
    amount: e.s.atk * scale, type: 'arts', isAttack: true, canDodge: true, tags: ['ux:writerCross'],
  });
}
function gaze(b, e, target) {
  const seq = target.deploySeq;
  b.addBuff(target, { key: 'ux:writerGaze', mods: { aspdMul: .5 }, interval: 1,
    onTick: () => b.dealDamage(e, target, { amount: target.s.maxHp * .04, type: 'arts', isDot: true, canDodge: false, tags: ['ux:writerGaze'] }),
  });
  // Owned by the affected operator: the curse remains after the writer leaves.
  b.on('death', c => {
    if (c.unit !== target || target.deploySeq !== seq) return;
    target.respawnAt = b.time + (target.respawnAt - b.time) * 1.5;
    sealGround(b, target.tileR, target.tileC);
  }, { owner: target });
}
function writer() {
  return [{
    spawn(b, e, a) {
      e.profile.rangeRadius = 99; e.profile.deferHit = true;
      b.addBuff(e, { key: 'ux:writer', persist: true, flags: { unblockable: true } });
      a.clocks = [[10, 20], [5, 10]]; a.rage = false;
    },
    attack(c, b, e) { for (const target of c.targets) cross(b, e, target.tileR, target.tileC, 1); },
    tick(b, e, a, dt) {
      const rage = e.hpRatio < .5;
      if (rage !== a.rage) {
        a.rage = rage;
        if (rage) b.addBuff(e, { key: 'ux:writerRage', persist: true, mods: { defPct: 1, resMul: 1.8, dmgDealtMul: 1.5 } });
        else b.removeBuff(e, 'ux:writerRage');
      }
      const clocks = a.clocks[Number(rage)];
      for (let i = 0; i < clocks.length; i++) clocks[i] = Math.max(0, clocks[i] - dt);
      if (!canCast(e, true, b)) return;
      if (clocks[0] <= 0) {
        clocks[0] = rage ? 15 : 20;
        // [ASSUMED] PRTS describes a short delay without a numeric value: use one second.
        for (const target of b.allies()) {
          const row = target.tileR, col = target.tileC;
          b.fx('telegraph', { x: col, y: row, dur: 1, kind: 'writer' });
          b.after(1, () => cross(b, e, row, col, .8));
        }
      }
      if (clocks[1] <= 0) {
        const target = byPriority(e, allTargets(b, e).filter(u => u.kind === 'op' && !u.findBuff('ux:writerGaze')))[0];
        if (target) { clocks[1] = rage ? 15 : 20; gaze(b, e, target); }
      }
    },
  }];
}
export const UNITE_WRITER_KITS = Object.freeze({ enemy_2020_cswrtr: writer });
