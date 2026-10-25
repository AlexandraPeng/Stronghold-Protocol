import { hypot, sin, cos } from '../../../detmath.js';
// 丰川祥子 — all three skills, note trajectories, shared Fever, module and talents.
// PRTS Togawa_Sakiko, 2026-10-12. Numeric skill/talent values come from official blackboards.
import { num, skillRec, talentBb, traitBb } from '../shared/tier1.js';
import { canTargetEnemy, absoluteRangeKeys, sortEnemyTargets } from '../../../targeting.js';
import { bodyInKeys, hitRect } from '../../../body.js';
import { dirVec } from '../../../dir.js';
import { TICK, COLS } from '../../../constants.js';
import { mujicaState, isMujica, live } from '../shared/mujica.js';
const C = 'char_4182_oblvns', S1 = 'skchr_oblvns_1', S2 = 'skchr_oblvns_2', S3 = 'skchr_oblvns_3';
const AIR = { canHitFly: true };
const PARAMS = {
  normal: { min: 0.1, update: 0.4, amp: 0.3, speed: 1.3, track: 2, turn: 7 / 30, radius: 1 },
  aimed: { min: 0.1, update: 0.4, amp: 0, speed: 2, track: 2, turn: 1 / 6, radius: 1 },
  s1: { min: 0.6, update: 0.2, amp: 0, speed: 1.7, track: 2.2, turn: 1 / 6, radius: 1 },
  piano: { min: 0.4, update: 0.2, amp: 0.4, speed: 1.9, track: 3.5, turn: 0.5, radius: 0.8, pierce: 0.5 },
  organ: { min: 0.4, update: 0.4, amp: 0.15, speed: 0.7, track: 1, turn: 1 / 12, radius: 1 },
  s3: { min: 0.8, update: 0.4, amp: 0.5, speed: 0.8, track: 1.3, turn: 0.25, radius: 1 },
};
const distance = (a, z) => hypot(a.x - z.x, a.y - z.y);
function touches(n, e, r = 0.12) {
  const box = hitRect(e);
  return box ? n.x >= box.x0 - r && n.x <= box.x1 + r && n.y >= box.y0 - r && n.y <= box.y1 + r : distance(n, e) <= r;
}
export default { [C]: (_bb, raw) => {
  const t0 = talentBb(raw, 0), t1 = talentBb(raw, 1), tb = traitBb(raw);
  const b1 = skillRec(raw, S1)?.bb || {}, b2 = skillRec(raw, S2)?.bb || {}, b3 = skillRec(raw, S3)?.bb || {};
  return {
    trait: { noAttack: true, install: null },
    skills: {
      [S1]: { kind: 'charges', trigger: 'NEVER', onStart({ unit }) { unit.mem.sakiko?.cast(); } },
      [S2]: { kind: 'instant', trigger: 'NEVER', onStart({ unit }) {
        if (unit.mem.sakiko) { unit.mem.sakiko.organ = !unit.mem.sakiko.organ; unit.mem.sakiko.tone(); }
      } },
      [S3]: { kind: 'duration', trigger: 'DEFAULT', targeting: { rangeGrid: skillRec(raw, S3)?.rangeGrid },
        onStart({ unit }) { unit.atkCd = 0; } },
    },
    install(b, u) {
      const f = mujicaState(b), s = u.skill;
      const m = u.mem.sakiko = { notes: [], organ: false, cast: null, tone: null, tick: 0, visual: 0 };
      const moduleEnhanced = raw.module?.active && (raw.talents || []).some(t => t.index === 0 && t.fromModule);
      const valid = e => canTargetEnemy(u, e, AIR);
      const foes = () => b.enemies.filter(e => valid(e) && bodyInKeys(e, u.rangeKeySet));
      const pick = () => { const list = foes(); sortEnemyTargets(b, u, list); return list[0] || null; };
      const remove = note => { f.notes.delete(note); note.dead = true; };
      m.tone = () => {
        b.removeBuff(u, 'sakiko:tone');
        if (s.id === S2) b.addBuff(u, { key: 'sakiko:tone',
          mods: m.organ ? { aspd: num(b2['attack@attack_speed']) } : { atkPct: num(b2['attack@atk']) } });
        if (s.id === S2) {
          u.form = m.organ ? 'sakiko-organ' : 'sakiko-piano';
          b.fx('swap', { id: u.id, x: u.x, y: u.y, form: u.form });
        }
      };
      const release = (type, mode, target = null, scale = 1, angle = null) => {
        const [dr, dc] = dirVec(u.dir);
        const a = (angle ?? (b.rng() * 40 - 20)) * Math.PI / 180;
        const hx = dc * cos(a) - dr * sin(a), hy = dr * cos(a) + dc * sin(a);
        const freeScale = moduleEnhanced && (s.id === S2 || s.active || mode === 's1');
        const ranged = u.blocking.length === 0 && !freeScale ? num(tb.atk_scale, 0.8) : 1;
        const note = { source: u, x: u.x, y: u.y, hx, hy, ox: u.x, oy: u.y, ax: hx, ay: hy, mode,
          param: PARAMS[mode], target, phase: 'free', age: 0, freeAge: 0, update: 0, outside: 0,
          sign: b.rng() < 0.5 ? -1 : 1, type, amount: u.s.atk * u.s.atkScaleMul * scale * ranged,
          hit: new Set(), dead: false, skill: mode === 's1' || mode === 's3' };
        m.notes.push(note); f.notes.add(note); return note;
      };
      const damage = (n, e) => {
        if (n.hit.has(e.id)) return;
        n.hit.add(e.id);
        b.dealDamage(u, e, { amount: n.amount, type: n.type, isAttack: n.mode !== 's1', isSkill: n.skill,
          tags: ['sakiko:note', n.mode], attackId: n.attackId });
      };
      const resetFree = n => {
        n.phase = 'free'; n.target = null; n.freeAge = 0; n.ox = n.x; n.oy = n.y; n.ax = n.hx; n.ay = n.hy;
      };
      // Integrate at the client's documented 30 Hz turning rate, independent of the battle tick.
      const move = (n, dt) => {
        const p = n.param; n.age += dt; n.update += dt;
        if (!live(u) && n.phase !== 'track') { remove(n); return; }
        if (n.phase === 'hit') {
          n.hitTime -= dt; n.x += n.hx * 3 * dt; n.y += n.hy * 3 * dt;
          for (const e of b.enemies) if (valid(e) && touches(n, e, 0.8)) damage(n, e);
          if (n.hitTime <= 0) remove(n);
          return;
        }
        if (n.update >= p.update - 1e-9) {
          n.update -= p.update;
          if (n.target && !valid(n.target)) resetFree(n);
          if (!n.target) n.target = b.enemies.filter(e => valid(e) && distance(n, e) <= p.radius)
            .sort((a, z) => distance(n, a) - distance(n, z) || a.id - z.id)[0] || null;
          if (n.phase === 'free' && n.target && n.age >= p.min) n.phase = 'track';
        }
        const oldX = n.x, oldY = n.y;
        if (n.phase === 'track' && n.target) {
          const dx = n.target.x - n.x, dy = n.target.y - n.y, d = hypot(dx, dy) || 1;
          const x = n.hx * (1 - p.turn) + dx / d * p.turn, y = n.hy * (1 - p.turn) + dy / d * p.turn;
          const len = hypot(x, y) || 1; n.hx = x / len; n.hy = y / len;
          n.x += n.hx * p.track * dt; n.y += n.hy * p.track * dt;
          if (valid(n.target) && touches(n, n.target, Math.max(0.12, p.track * dt))) {
            damage(n, n.target);
            if (p.pierce) { n.phase = 'hit'; n.hitTime = p.pierce; }
            else remove(n);
          }
        } else {
          n.freeAge += dt; const x = n.freeAge * p.speed;
          const y = p.amp * Math.min(3, Math.floor(x / (2 * Math.PI)) + 1) * sin(x) * n.sign;
          n.x = n.ox + n.ax * x - n.ay * y; n.y = n.oy + n.ay * x + n.ax * y;
          const len = hypot(n.x - oldX, n.y - oldY);
          if (len > 1e-9) { n.hx = (n.x - oldX) / len; n.hy = (n.y - oldY) / len; }
        }
        const inRange = u.rangeKeySet.has(Math.round(n.y) * COLS + Math.round(n.x));
        n.outside = !inRange && !n.target ? n.outside + dt : 0;
        if (n.outside > num(t0.delay, 1)) remove(n);
      };
      m.cast = () => {
        // Eight emission frames; fixed animation scheduling is documented in the implementation notes.
        u.mem.noteCastUntil = b.time + 1.3;
        const seq = u.deploySeq;
        for (let i = 0; i < 8; i++) b.after(0.267 + i * 0.1, () => {
          if (live(u) && u.deploySeq === seq && u.canAct)
            release('arts', 's1', null, num(b1[i ? `atk_scale_${i + 1}` : 'atk_scale']), -13.125 + i * 3.75);
        }, { owner: u, holdsBattle: true });
      };
      b.on('hit', ({ source, dmg }) => {
        if (!live(u) || !isMujica(source)) return;
        const count = Math.min(num(t0.max_cnt), f.notes.size);
        const def = count * num(t0.def_penetrate_ratio), res = count * num(t0.magic_resist_penetrate_ratio);
        // Same-named talents use the strongest contribution across duplicate operators.
        dmg.defIgnorePct += Math.max(0, def - (dmg.sakikoDef || 0));
        dmg.resIgnorePct += Math.max(0, res - (dmg.sakikoRes || 0));
        dmg.sakikoDef = Math.max(def, dmg.sakikoDef || 0);
        dmg.sakikoRes = Math.max(res, dmg.sakikoRes || 0);
      }, { owner: u, priority: 10 });
      b.on('damaged', ({ source, target, amount }) => {
        if (source === u && target.side === 'enemy' && amount > 0) f.gain(num(t1.cnt));
      }, { owner: u });
      b.on('fatal', c => {
        if (c.prevented || !live(u) || s.id !== S3 || !s.active || b.time >= f.until || !isMujica(c.unit)) return;
        c.prevented = true; f.saved.set(c.unit, c.unit.deploySeq);
      }, { owner: u, priority: -3000 });
      b.on('deploy', ({ unit }) => { if (unit === u) { m.organ = false; m.tone(); u.mem.noteCastUntil = 0; } }, { owner: u });
      b.every(TICK, () => {
        m.tick += TICK;
        while (m.tick >= 1 / 30 - 1e-9) { for (const n of m.notes) if (!n.dead) move(n, 1 / 30); m.tick -= 1 / 30; }
        m.notes = m.notes.filter(n => !n.dead);
        if (!live(u)) return;
        // Only the original range participates in the overlap test; no circular extension.
        const original = new Set(absoluteRangeKeys(raw.rangeGrid, u.tileR, u.tileC, u.dir, u.s.baseRangeExtend));
        const extra = [];
        for (const a of b.allyUnits) if (a !== u && isMujica(a) && live(a)) {
          const ak = absoluteRangeKeys(a.rangeGrid, a.tileR, a.tileC, a.dir, a.s.baseRangeExtend);
          if (ak.some(k => original.has(k))) extra.push(...ak);
        }
        b.setExtraRange(u, extra);
        for (const a of b.alliesFor(u)) if (a.kind === 'op' && bodyInKeys(a, u.rangeKeySet))
          b.applyStrongest(a, 'sakiko:tempo', { duration: TICK * 2, value: num(t1.attack_speed), mods: v => ({ aspd: v }), source: u });
        if (num(tb.attack_speed) && foes().length >= 2) b.addBuff(u, { key: 'sakiko:module', duration: TICK * 2, mods: { aspd: num(tb.attack_speed) } });
        if (!u.canAct || u.s.flags.disarm || b.time < (u.mem.noteCastUntil || 0)) return;
        if (s.id === S1 && s.charges === s.maxCharges && !s.opCooling) s.activate('full-charge');
        if (s.id === S1 && f.value >= 450 && s.ready && foes().length && !s.opCooling) s.activate('DEFAULT');
        if (s.id === S2 && s.ready && !s.opCooling && foes().length) s.activate('DEFAULT');
        if (u.atkCd > 0 || b.time < (u.mem.noteCastUntil || 0)) return;
        const target = pick(), [dr, dc] = dirVec(u.dir);
        if (!target && !b.grid.groundPassable(u.tileR + dr, u.tileC + dc)) return;
        const attackId = ++b._attackSeq, count = s.id === S2 && b.time < f.until ? 2 : 1;
        const before = m.notes.length;
        if (s.id === S3 && s.active) {
          const list = foes();
          const by = attr => list.slice().sort((a, z) => z.s[attr] - a.s[attr] || a.id - z.id)[0] || null;
          for (let i = 0; i < 2; i++) { release('phys', 's3', by('res'), num(b3['attack@atk_scale'])); release('arts', 's3', by('def'), num(b3['attack@atk_scale'])); }
        } else for (let i = 0; i < count; i++) {
          if (s.id === S2) release(m.organ ? 'arts' : 'phys', m.organ ? 'organ' : 'piano', target);
          else release('phys', target ? 'aimed' : 'normal', target);
        }
        for (const n of m.notes.slice(before)) n.attackId = attackId;
        u.stats.attacks++; u.lastAttackAt = b.time; u.atkCd = u.s.interval;
        b._ev(['atk', u.id, target?.id || u.id, 'none']);
        b.emit('attack', { attacker: u, targets: target ? [target] : [], isSkill: s.id === S3 && s.active });
        s.onAttackPerformed(target ? [target] : [], s.id === S3 && s.active);
      }, { owner: u });
    },
  };
} };
