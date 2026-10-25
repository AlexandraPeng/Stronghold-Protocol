// Optional encounter fixtures. Absence of the event terrain does not turn a conditional ability into a permanent one.
export function filmed(b, e) {
  if (e.s.flags.filming) return true;
  return (b.flags.filmingZones ?? []).some(z => z.active !== false && e.x >= z.c0 - .5 && e.x <= z.c1 + .5 && e.y >= z.r0 - .5 && e.y <= z.r1 + .5);
}
export function cameras(b) { return (b.flags.filmingCameras ?? []).filter(c => c.active !== false); }

/** PRTS 源石冰晶: 13 tiles (Manhattan radius 2), cold 10 s every 15 s, rewrites ground passage. */
export function summonIceCrystal(b, source, pos) {
  const [row, col] = pos;
  if (!b.grid.inRect(row, col)) return null;
  const key = `${row},${col}`, crystals = b._uniteIceCrystals ??= new Map();
  if (crystals.has(key)) return crystals.get(key);
  // Encounter devices have no attackable enemy HP bar in this mode. Their map effect outlives the summoner.
  const crystal = { row, col, active: true };
  crystals.set(key, crystal); b.setObstacle(row, col, true);
  b.fx('telegraph', { x: col, y: row, kind: 'iceCrystal', tiles: 'box', r: 0, dur: 99999 });
  crystal.timer = b.every(15, () => {
    if (!crystal.active) return;
    for (const u of b.allies()) if (Math.abs(u.tileR-row)+Math.abs(u.tileC-col) <= 2) {
      b.applyStatus(u, 'cold', { duration: 10, source, ignoreSelect: true });
    }
  });
  return crystal;
}

/** Snow avalanche is a stage rule, not an unconditional second damage hit (PRTS 巨角卢鲁). */
export function avalanche(b, source, target) {
  const config = b.flags.avalanche;
  if (!config || target.kind !== 'op' || !target.alive) return false;
  const dx = target.x-source.x, dy = target.y-source.y;
  const dr = Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0;
  const dc = dr ? 0 : Math.sign(dx || -1);
  const row = target.tileR+dr, col = target.tileC+dc;
  const moved = b.grid.canStand(row, col, { ranged: target.def.position === 'RANGED' }) && b.relocate(target, row, col);
  if (!moved) {
    // Values are explicit encounter inputs; there is no universal damage/stun value on the enemy's Wiki page.
    if (config.blockedDamage > 0) b.dealDamage(source, target, { amount: config.blockedDamage, type: config.damageType ?? 'phys', canDodge: false });
    if (target.alive && config.blockedStun > 0) b.applyStatus(target, 'stun', { duration: config.blockedStun, source });
  }
  return !!moved;
}
