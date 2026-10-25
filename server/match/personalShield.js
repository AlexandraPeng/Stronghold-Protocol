// Custom-mode player objective shield. It is never an operator combat barrier.
export function addPersonalShield(ps, amount) {
  if (!ps?.m?.uniteStacking || !Number.isFinite(amount) || amount <= 0) return 0;
  const gain = Math.floor(amount);
  ps.lpShield = Math.max(0, Number(ps.lpShield) || 0) + gain;
  ps.dirty();
  return gain;
}

export function absorbPersonalLoss(ps, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return { loss: 0, absorbed: 0 };
  if (!ps?.m?.uniteStacking) return { loss: amount, absorbed: 0 };
  const absorbed = Math.min(amount, Math.max(0, Number(ps.lpShield) || 0));
  ps.lpShield = Math.max(0, (Number(ps.lpShield) || 0) - absorbed);
  if (absorbed > 0) ps.dirty();
  return { loss: amount - absorbed, absorbed };
}

/** A shared leader hit is allocated by the same entry-LP shares as the team HP.
 * Each shield protects only its owner's share, never another player's damage.
 */
export function absorbTeamLoss(players, amount) {
  const total = players.reduce((n, ps) => n + Math.max(0, ps.lpAtFinal || 0), 0);
  if (!players.length || !(amount > 0) || !Number.isFinite(amount)) return amount;
  let remaining = 0;
  for (const ps of players) {
    const share = total > 0 ? Math.max(0, ps.lpAtFinal || 0) / total : 1 / players.length;
    remaining += absorbPersonalLoss(ps, amount * share).loss;
  }
  return remaining;
}
