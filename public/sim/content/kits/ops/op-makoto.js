// 结城理: PRTS 结城理 (2026-10-12), official CN blackboards. See docs/research/extra-diy.md.
// Own form controller: S3's second substitute must retain the original expiry and may block.
import { num, talentBb, traitBb, skillRec, up } from '../shared/tier1.js';
import { absoluteRangeKeys, canTargetEnemy } from '../../../targeting.js';
import { bodyInKeys } from '../../../body.js';
import { performAttack } from '../../../ai.js';
import { mitigate } from '../../../damage.js';
import { TICK } from '../../../constants.js';

const ID = 'char_4217_makoto';
const IDS = [1, 2, 3].map(n => `skchr_makoto_${n}`);
const SEES = new Set([ID, 'char_4218_aigis', 'char_4219_yukari', 'char_4220_kormr']);
const SWITCH = 1; // Doll_Skill_*_SwitchIn animation duration in the downloaded Spine data
const TOTAL = 1.6;
export default { [ID]: (_bb, raw) => {
  const t = talentBb(raw, 0), captain = talentBb(raw, 1), trait = traitBb(raw);
  const skills = Object.fromEntries(IDS.map(id => [id, { kind: 'instant', trigger: 'NEVER',
    onStart({ unit }) { unit.mem.makoto?.switchPersona(); } }]));
  return { trait: { install: null }, skills, install(b, u) {
    const s = u.skill, n = IDS.indexOf(s.id), bb = skillRec(raw, s.id)?.bb || {};
    const grid = skillRec(raw, s.id)?.rangeGrid || raw.trait?.rangeGrid;
    const originalProfile = { ...u.profile }, originalGrid = u.rangeGrid;
    const m = u.mem.makoto = { phase: 'body', until: 0, switching: 0, healAt: 0, executeAt: 0 };
    const keys = () => absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir, 0);
    const injured = () => b.injuredAlliesInKeys(keys(), u).sort((a, z) => a.hp / a.s.maxHp - z.hp / z.s.maxHp || a.id - z.id);
    const enemies = (air = false) => b.enemies.filter(e => canTargetEnemy(u, e, { canHitFly: air }) && bodyInKeys(e, new Set(keys())));
    const switchGuard = () => {
      s.end('substitute');
      for (const buff of u.buffs.slice()) if (buff.status) b.removeBuff(u, buff);
      m.switching = b.time + SWITCH;
      b.addBuff(u, { key: 'makoto:switch', duration: SWITCH,
        flags: { invulnerable: true, noSp: true, noHeal: true, healFree: true, isolated: true, disarm: true, silence: true },
        onExpire() { if (up(u)) { u.markDirty(); u.hp = u.s.maxHp; m.healAt = b.time; } } });
    };
    const formBuff = () => {
      const defender = n === 2 && m.phase === 'orpheus';
      b.addBuff(u, { key: 'makoto:persona',
        mods: { atkPct: num(t.atk), hpPct: num(t.max_hp_t1) + num(trait.max_hp),
          batPct: num(t.base_attack_time) / u.base.bat, ...(!defender ? { blockCnt: -99 } : {}),
          ...(n === 2 && !defender ? { aspd: num(bb['talent@attack_speed']) } : {}) },
        flags: { noSp: true, ...(!defender ? { noBlock: true } : {}), ...(n !== 2 || defender ? { silence: true } : {}) } });
      u.rangeGrid = grid;
      Object.assign(u.profile, originalProfile, { noAttack: true });
      b._refreshRange(u);
    };
    const totalAttack = () => {
      m.phase = 'total'; u.trait.doll = false; b.emit('dollSwap', { unit: u, form: null }); u.form = 'makoto-total';
      b.fx('swap', { id: u.id, x: u.x, y: u.y, form: u.form, dur: TOTAL });
      b.removeBuff(u, 'makoto:persona');
      u.rangeGrid = originalGrid; Object.assign(u.profile, originalProfile, { noAttack: true });
      b._refreshRange(u); u.markDirty(); u.hp = u.s.maxHp;
      b.addBuff(u, { key: 'makoto:total', duration: TOTAL,
        flags: { invulnerable: true, silence: true, noSp: true, disarm: true },
        onExpire() { if (!up(u)) return; m.phase = 'body'; u.form = null; Object.assign(u.profile, originalProfile);
          b.fx('swap', { id: u.id, x: u.x, y: u.y, form: null }); } });
      const atk = u.s.atk * num(captain.atk_scale);
      for (const ally of b.alliesFor(u)) {
        if (ally !== u && (!SEES.has(ally.def?.charId) || ally.def.charId === ID)) continue;
        const delay = ally === u ? 0 : Math.max(0, (ally.mem.seesNextAttack || 0) - b.time);
        if (ally !== u) ally.mem.seesNextAttack = b.time + delay + TOTAL;
        const seq = ally.deploySeq;
        const hit = () => {
          if (!up(ally) || ally.deploySeq !== seq) return;
          const area = new Set(absoluteRangeKeys(grid, ally.tileR, ally.tileC, ally.dir, 0));
          b.fx('blast', { id: ally.id, x: ally.x, y: ally.y, r: 2 });
          for (const e of b.enemies) if (canTargetEnemy(ally, e, { canHitFly: true }) && bodyInKeys(e, area))
            b.dealDamage(u, e, { amount: atk, type: 'true', tags: ['makoto:total'] });
        };
        if (delay) b.after(delay, hit, { owner: ally, holdsBattle: true }); else hit();
      }
    };
    m.switchPersona = () => {
      if (!up(u) || b.time < m.switching || m.phase === 'total') return false;
      const first = m.phase === 'body';
      if (!first && !(n === 2 && m.phase === 'thanatos')) return false;
      m.phase = first && n !== 0 ? 'thanatos' : 'orpheus';
      if (first) m.until = b.time + SWITCH + num(trait.duration, 20);
      switchGuard(); formBuff(); u.trait.doll = true;
      u.form = n === 0 ? 'makoto-s1' : n === 1 ? 'makoto-s2' : m.phase === 'thanatos' ? 'makoto-s3' : 'makoto-heal';
      if (first) {
        b.releaseBlocked(u);
        for (const e of enemies(true)) b.applyStatus(e, 'sluggish', { duration: num(t.sluggish), source: u });
      }
      u.markDirty(); u.hp = u.s.maxHp;
      b.fx('substitute', { id: u.id, x: u.x, y: u.y, form: u.form, dur: m.until - b.time });
      b.emit('dollSwap', { unit: u, form: 'doll' });
      return true;
    };
    // The second S3 cast is free and available only after the first switch completes.
    const activate = s.activate.bind(s);
    s.activate = (reason, opts) => {
      if (n === 2 && m.phase === 'thanatos') {
        if (b.time < m.switching || !u.canAct || u.s.flags.silence) return false;
        return activate(reason, { free: true });
      }
      if (m.phase !== 'body' || !u.canAct || u.s.flags.silence) return false;
      return activate(reason, opts);
    };
    b.on('fatal', c => {
      if (c.unit !== u || c.prevented) return;
      if (b.time < m.switching || m.phase === 'total') c.prevented = true;
      else if (m.phase === 'body' || (n === 2 && m.phase === 'thanatos')) c.prevented = m.switchPersona();
    }, { owner: u, priority: -100 });
    b.on('beforeStatus', c => {
      if (c.target === u && b.time < m.switching && ['stun', 'freeze', 'sleep'].includes(c.status)) c.cancel = true;
    }, { owner: u });
    b.on('hit', c => {
      if (c.source !== u || !c.dmg.tags?.includes('makoto:weak')) return;
      const ign = { defIgnorePct: c.dmg.defIgnorePct + u.s.defIgnorePct, defIgnoreFlat: c.dmg.defIgnoreFlat + u.s.defIgnoreFlat,
        resIgnorePct: c.dmg.resIgnorePct + u.s.resIgnorePct, resIgnoreFlat: c.dmg.resIgnoreFlat + u.s.resIgnoreFlat };
      const p = mitigate(c.dmg.amount, 'phys', c.target.s, ign), a = mitigate(c.dmg.amount, 'arts', c.target.s, ign);
      c.dmg.type = p > a + 1e-6 ? 'phys' : 'arts';
    }, { owner: u, priority: -50 });
    b.on('deploy', ({ unit }) => {
      if (unit !== u) return;
      m.phase = 'body'; m.switching = 0; u.trait.doll = false; u.form = null;
      u.rangeGrid = originalGrid; Object.assign(u.profile, originalProfile); b._refreshRange(u);
    }, { owner: u });
    b.every(TICK, () => {
      if (!up(u)) return;
      if (m.phase === 'body') {
        if (s.ready && !s.opCooling && u.canAct && (enemies(true).length || (n === 0 && injured().some(a => a.hp <= a.s.maxHp * 0.5)))) s.activate('DEFAULT');
        return;
      }
      if (m.phase === 'total') return;
      if (b.time >= m.until) { totalAttack(); return; }
      if (b.time < m.switching) return;
      // Auto-chess adaptation: use the free defensive recast when an ally is at half HP.
      if (n === 2 && m.phase === 'thanatos' && !s.opCooling && injured().some(a => a.hp <= a.s.maxHp * 0.5)) {
        if (s.activate('DEFAULT')) return;
      }
      if (n === 2 && m.phase === 'orpheus') {
        for (const a of b.alliesFor(u)) if (a.kind === 'op' && bodyInKeys(a, new Set(keys())))
          b.applyStrongest(a, 'makoto:dodge', { duration: TICK * 2, value: num(bb['attack@prob']),
            mods: v => ({ dodgePhys: v, dodgeArts: v }), source: u });
        if (b.time >= m.healAt) {
          m.healAt = b.time + num(bb['attack@interval'], 1);
          for (const a of injured().slice(0, num(bb['attack@max_target_heal'], 4))) {
            const seq = u.deploySeq, targetSeq = a.deploySeq;
            b.after(0.5, () => { if (up(u) && u.deploySeq === seq && up(a) && a.deploySeq === targetSeq)
              b.heal(u, a, u.s.atk * num(bb['attack@heal_scale'])); }, { owner: u });
          }
        }
        return;
      }
      if (n === 1 && b.time >= m.executeAt) {
        m.executeAt = b.time + 0.1;
        for (const e of enemies(true)) if (e.s.flags.fear && e.hp <= u.s.atk * num(bb['attack@kill_atk_scale']))
          b.dealDamage(u, e, { amount: num(bb['attack@kill_damage']), type: 'true', sourceless: true, canDodge: false, pierceBarrier: true, tags: ['execute', 'makoto:execute'] });
      }
      if (!u.canAct || u.s.flags.disarm || u.atkCd > 0) return;
      const heal = n === 0 ? injured().find(a => a.hp <= a.s.maxHp * 0.5) : null;
      if (heal) {
        performAttack(b, u, { ...originalProfile, noAttack: false, dmgType: 'heal', heal: { mode: 'single' }, healScale: num(bb['attack@heal_scale']) }, [heal]);
      } else {
        const targets = enemies(n === 2).slice(0, num(bb['attack@max_target'], 1));
        if (!targets.length) return;
        performAttack(b, u, { ...originalProfile, noAttack: false, attack: 'melee', projectile: 'none', dmgType: 'arts',
          canHitFly: n === 2, atkScale: num(bb['attack@atk_scale']),
          ...(n === 1 ? { afterHit(_b, _u, target) { if (b.rng() < num(bb['attack@prob'])) b.applyStatus(target, 'fear', { duration: num(bb['attack@fear']), source: u }); } } : {}),
          ...(n === 2 ? { tags: ['makoto:weak'] } : {}) }, targets);
      }
      u.atkCd = u.s.interval;
    }, { owner: u });
  } };
} };
