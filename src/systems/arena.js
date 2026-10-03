// Deterministic combat simulation; rendering and input live in CombatScene.
export function createArena(width, height) {
  return {
    width,
    height,
    player: { x: width / 2, y: height / 2, hp: 100 },
    enemies: [],
    bolts: [],
    elapsed: 0,
    spawn: 0,
    attack: 0,
    invulnerable: 0,
    nextId: 1,
  };
}
export function stepArena(
  arena,
  deltaMs,
  stats,
  input = {},
  random = Math.random,
) {
  const dt = Math.min(Math.max(deltaMs, 0), 50) / 1000;
  const events = [];
  const p = arena.player;
  arena.elapsed += dt;
  let dx = input.x || 0,
    dy = input.y || 0;
  const length = Math.hypot(dx, dy);
  if (length > 1) {
    dx /= length;
    dy /= length;
  }
  p.x = Math.max(20, Math.min(arena.width - 20, p.x + dx * 155 * dt));
  p.y = Math.max(88, Math.min(arena.height - 36, p.y + dy * 155 * dt));
  arena.spawn -= dt;
  if (arena.spawn <= 0 && arena.enemies.length < 30) {
    const side = Math.floor(random() * 4);
    const enemy = {
      id: arena.nextId++,
      x: side < 2 ? (side ? arena.width + 12 : -12) : random() * arena.width,
      y:
        side < 2
          ? 90 + random() * Math.max(1, arena.height - 130)
          : side === 2
            ? 75
            : arena.height + 12,
      hp: 10 + Math.floor(arena.elapsed / 30) * 2,
      kind: Math.floor(random() * 3),
    };
    arena.enemies.push(enemy);
    arena.spawn = Math.max(0.65, 1.6 - arena.elapsed / 220);
  }
  arena.attack -= dt;
  if (arena.attack <= 0 && arena.enemies.length) {
    const nearest = [...arena.enemies].sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    )[0];
    if (Math.hypot(nearest.x - p.x, nearest.y - p.y) < 270) {
      const angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      arena.bolts.push({
        id: arena.nextId++,
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * 320,
        vy: Math.sin(angle) * 320,
        life: 1.6,
        damage: stats.atk * (random() < (stats.crit ?? 0.05) ? 2 : 1),
      });
      arena.attack = 0.46;
      events.push({ type: "shot" });
    }
  }
  for (const bolt of arena.bolts) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
    for (const enemy of arena.enemies) {
      if (
        enemy.hp > 0 &&
        bolt.life > 0 &&
        Math.hypot(bolt.x - enemy.x, bolt.y - enemy.y) < 19
      ) {
        enemy.hp -= bolt.damage;
        bolt.life = 0;
        events.push({
          type: "hit",
          x: enemy.x,
          y: enemy.y,
          damage: bolt.damage,
        });
      }
    }
  }
  arena.invulnerable = Math.max(0, arena.invulnerable - dt);
  for (const enemy of arena.enemies) {
    if (enemy.hp <= 0) {
      events.push({ type: "kill", x: enemy.x, y: enemy.y });
      continue;
    }
    const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y) || 1;
    const speed = 24 + enemy.kind * 6 + arena.elapsed / 18;
    enemy.x += ((p.x - enemy.x) / distance) * speed * dt;
    enemy.y += ((p.y - enemy.y) / distance) * speed * dt;
    if (distance < 23 && arena.invulnerable <= 0) {
      p.hp = Math.max(0, p.hp - Math.max(2, 9 - stats.def * 0.5));
      arena.invulnerable = 0.8;
      events.push({ type: "hurt" });
    }
  }
  if (p.hp > 0) p.hp = Math.min(100, p.hp + (0.5 + stats.def * 0.06) * dt);
  arena.enemies = arena.enemies.filter((e) => e.hp > 0);
  arena.bolts = arena.bolts.filter((b) => b.life > 0);
  return events;
}
