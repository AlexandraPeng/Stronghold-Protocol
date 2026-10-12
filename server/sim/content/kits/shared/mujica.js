// Shared, field-local Fever state. Never module-global: independent rooms must not share it.
import { TICK } from '../../../constants.js';
export const MUJICA = new Set(['char_4182_oblvns', 'char_4183_mortis', 'char_4184_dolris', 'char_4185_amoris', 'char_4186_tmoris']);
export const isMujica = u => u?.kind === 'op' && MUJICA.has(u.def?.charId);
export const live = u => u?.alive && u.deployed && !u.hidden;
export function mujicaState(b) {
  if (b.mujica) return b.mujica;
  const f = b.mujica = { value: 0, until: 0, participants: new Map(), saved: new Map(), notes: new Set() };
  const members = () => b.allyUnits.filter(u => isMujica(u) && live(u));
  f.gain = n => { if (b.time >= f.until) f.value = Math.min(450, f.value + n); };
  f.start = () => {
    if (f.value < 450 || b.time < f.until) return false;
    f.value = 0; f.until = b.time + 20; f.participants.clear();
    for (const u of members()) {
      const s = u.skill;
      f.participants.set(u, { seq: u.deploySeq, active: !!s?.active, remaining: s?.timeLeft });
      b.fx('fever', { id: u.id, x: u.x, y: u.y, n: 450, dur: 20 });
    }
    b.emit('feverStart', { state: f }); return true;
  };
  b.on('skillStart', ({ unit, reason }) => {
    // Auto-charged S1 specifically does not start Fever. Mode automation is a manual-skill operation.
    if (isMujica(unit) && !['fever', 'full-charge', 'passive'].includes(reason)) f.start();
  });
  b.every(TICK, () => {
    const active = b.time < f.until;
    if (!active && f.participants.size) {
      for (const [u, p] of f.participants) {
        if (!live(u) || u.deploySeq !== p.seq) continue;
        if (!p.active && u.skill?.active) u.skill.end('fever');
      }
      for (const [u, seq] of f.saved) if (live(u) && u.deploySeq === seq) b.kill(u);
      f.saved.clear(); f.participants.clear(); b.emit('feverEnd', { state: f });
    }
    if (!active) return;
    for (const u of members()) {
      const s = u.skill;
      if (!s || s.id === 'skchr_oblvns_2') continue;
      if (!f.participants.has(u)) f.participants.set(u, { seq: u.deploySeq, active: false });
      const p = f.participants.get(u);
      if (p.seq !== u.deploySeq) { f.participants.set(u, { seq: u.deploySeq, active: false }); continue; }
      if (s.active && s.isTimed && Number.isFinite(s.timeLeft)) s.extend(TICK);
      if (!s.active && u.canAct && !u.s.flags.silence && !u.s.flags.disarm && b.time >= (u.mem.noteCastUntil || 0))
        s.activate('fever', { free: true });
    }
  });
  return f;
}
