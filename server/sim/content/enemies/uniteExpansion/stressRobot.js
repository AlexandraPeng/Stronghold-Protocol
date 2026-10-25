// PRTS 压力舒缓帮手: its bounce value is 3 in the default “某种天命” table.
// [ASSUMED] PRTS leaves the elastic-body integrator unspecified. Use the engine's deterministic radial push
// with the documented force, once per collision per second, rather than adding damage to its ordinary attack.
export const UNITE_STRESS_KITS = Object.freeze({
  enemy_10119_ymgbxm: () => [{
    spawn(b, e, a) { e.mem.fateBounceForce = 3; a.cooldown = new Map(); },
    tick(b, e, a) {
      for (const u of b.enemiesInRadius(e.x, e.y, .5)) {
        if (u.defId !== 'enemy_10111_ymgpck' || u.hidden || b.time < (a.cooldown.get(u) ?? 0)) continue;
        a.cooldown.set(u, b.time+1); b.push(u, 3, { from: e });
      }
    },
  }],
});
