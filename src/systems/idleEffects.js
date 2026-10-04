// Idle enemies use the same four-second curses and rune effects as the arena.
export function strikeIdleEnemy(enemy, stats, random = Math.random) {
  const critical = random() < stats.crit;
  const aura =
    stats.aura === "fury" ? stats.auraLevel * 0.1 + stats.attackSynergy : 0;
  const curse =
    enemy.curseTimer > 0 && enemy.curse === "frailty"
      ? enemy.curseLevel * 0.08
      : 0;
  const damage =
    stats.atk * (1 + stats.synergy) * (1 + aura + curse) * (critical ? 2 : 1);
  const actual = Math.min(enemy.hp, damage);
  enemy.hp -= damage;
  if (stats.curse || stats.slow) {
    Object.assign(enemy, {
      curse: stats.curse,
      curseLevel: stats.curseLevel,
      slow: stats.slow,
      curseTimer: 4,
    });
  }
  return { damage, critical, healing: actual * stats.lifeSteal };
}

export function advanceIdleEnemy(enemy, deltaMs, stats) {
  const dt = Math.min(50, Math.max(0, deltaMs)) / 1000;
  const slow =
    enemy.curseTimer > 0
      ? Math.min(
          0.65,
          (enemy.slow || 0) +
            (enemy.curse === "chill" ? (enemy.curseLevel || 1) * 0.12 : 0),
        )
      : 0;
  enemy.curseTimer = Math.max(0, (enemy.curseTimer || 0) - dt);
  enemy.attackCharge = (enemy.attackCharge || 0) + dt * (1 - slow);
  if (enemy.hp <= 0 || enemy.attackCharge < 1) return 0;
  enemy.attackCharge -= 1;
  return Math.max(1, 4 - stats.def * 0.5);
}
