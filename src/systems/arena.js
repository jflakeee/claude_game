import { initEncounter, updateEncounters } from "./encounters.js";
// Deterministic combat simulation; rendering and input live in CombatScene.
export function createArena(width, height, options = {}) {
  const arena = {
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
  return initEncounter(arena, options);
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
  updateEncounters(arena, dt, stats, random, events);
  let dx = input.x || 0,
    dy = input.y || 0;
  const length = Math.hypot(dx, dy);
  if (length > 1) {
    dx /= length;
    dy /= length;
  }
  const moveSpeed = arena.playerHex > 0 ? 148 : 155;
  p.x = Math.max(20, Math.min(arena.width - 20, p.x + dx * moveSpeed * dt));
  p.y = Math.max(
    arena.encounter === "boss" ? 145 : 88,
    Math.min(arena.height - 36, p.y + dy * moveSpeed * dt),
  );
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
    arena.spawn =
      arena.encounter === "boss"
        ? 5
        : Math.max(0.65, 1.6 - arena.elapsed / 220);
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
        damage:
          stats.atk *
          (1 + (stats.synergy || 0)) *
          (random() < (stats.crit ?? 0.05) ? 2 : 1),
        pierce: stats.pierce || 0,
        hitIds: [],
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
        !bolt.hitIds.includes(enemy.id) &&
        Math.hypot(bolt.x - enemy.x, bolt.y - enemy.y) < (enemy.boss ? 33 : 19)
      ) {
        const auraBonus =
          stats.aura === "fury" &&
          Math.hypot(enemy.x - p.x, enemy.y - p.y) < 130
            ? stats.auraLevel * 0.1 + stats.attackSynergy
            : 0;
        const curseBonus =
          enemy.curseTimer > 0 && enemy.curse === "frailty"
            ? (enemy.curseLevel || 1) * 0.08
            : 0;
        const damage = bolt.damage * (1 + auraBonus + curseBonus),
          actual = Math.min(enemy.hp, damage);
        enemy.hp -= damage;
        bolt.hitIds.push(enemy.id);
        if (bolt.pierce-- <= 0) bolt.life = 0;
        if (stats.curse || stats.slow) {
          enemy.curse = stats.curse;
          enemy.curseLevel = stats.curseLevel;
          enemy.curseTimer = 4;
          enemy.slow = stats.slow || 0;
        }
        p.hp = Math.min(100, p.hp + actual * (stats.lifeSteal || 0));
        events.push({
          type: "hit",
          x: enemy.x,
          y: enemy.y,
          damage,
        });
      }
    }
  }
  arena.invulnerable = Math.max(0, arena.invulnerable - dt);
  for (const enemy of arena.enemies) {
    if (enemy.hp <= 0) {
      if (enemy.boss) arena.bossDefeated = true;
      events.push({ type: "kill", x: enemy.x, y: enemy.y, boss: !!enemy.boss });
      continue;
    }
    const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y) || 1;
    const slowed =
      enemy.curseTimer > 0
        ? Math.min(
            0.65,
            (enemy.slow || 0) +
              (enemy.curse === "chill" ? (enemy.curseLevel || 1) * 0.12 : 0),
          )
        : 0;
    const enraged =
      enemy.packId &&
      arena.enemies.some(
        (e) => e.leader && e.packId === enemy.packId && e.hp > 0,
      )
        ? 1.08
        : 1;
    const speed = enemy.boss
      ? 0
      : (24 + enemy.kind * 6 + arena.elapsed / 18) * (1 - slowed) * enraged;
    enemy.x += ((p.x - enemy.x) / distance) * speed * dt;
    enemy.y += ((p.y - enemy.y) / distance) * speed * dt;
    if (distance < 23 && arena.invulnerable <= 0) {
      p.hp = Math.max(
        0,
        p.hp -
          Math.max(
            2,
            (enemy.boss ? 16 : 9) -
              stats.def * (arena.playerHex > 0 ? 0.325 : 0.5),
          ),
      );
      arena.invulnerable = 0.8;
      events.push({ type: "hurt" });
    }
  }
  if (p.hp > 0)
    p.hp = Math.min(
      100,
      p.hp +
        (0.5 +
          stats.def * 0.06 +
          (stats.regen || 0) +
          (stats.aura === "renewal"
            ? stats.auraLevel * 0.6 + stats.defenseSynergy
            : 0)) *
          dt,
    );
  arena.enemies = arena.enemies.filter((e) => e.hp > 0);
  arena.bolts = arena.bolts.filter((b) => b.life > 0);
  return events;
}
