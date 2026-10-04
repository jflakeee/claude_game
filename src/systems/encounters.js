import { BOSS_NAMES } from "../data/expansion.js";
export function initEncounter(
  arena,
  { encounter = "survival", bossWins = 0 } = {},
) {
  Object.assign(arena, {
    encounter,
    packTimer: 18,
    hazards: [],
    enemyShots: [],
    playerHex: 0,
    bossDefeated: false,
    patternTimer: 3,
    patternIndex: bossWins % 3,
  });
  if (encounter === "boss") {
    const hp = 360 + Math.min(bossWins, 8) * 60;
    arena.enemies.push({
      id: arena.nextId++,
      x: arena.width / 2,
      y: arena.height * 0.42,
      hp,
      maxHp: hp,
      boss: true,
      kind: 2,
      name: BOSS_NAMES[bossWins % 3],
      phase: 1,
    });
    arena.player.y = arena.height * 0.75;
    arena.spawn = 12;
  }
  return arena;
}
function hitPlayer(arena, stats, damage, events) {
  if (arena.invulnerable > 0 || arena.player.hp <= 0) return;
  const armor = stats.def * (arena.playerHex > 0 ? 0.65 : 1);
  arena.player.hp = Math.max(
    0,
    arena.player.hp - Math.max(3, damage - armor * 0.35),
  );
  arena.invulnerable = 0.75;
  events.push({ type: "hurt" });
}
function lineDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function updateEncounters(arena, dt, stats, random, events) {
  const p = arena.player;
  arena.playerHex = Math.max(0, arena.playerHex - dt);
  for (const e of arena.enemies) {
    e.curseTimer = Math.max(0, (e.curseTimer || 0) - dt);
    if (e.leader && e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 100)
      arena.playerHex = 2;
  }
  arena.packTimer -= dt;
  if (arena.packTimer <= 0 && arena.enemies.length < 25) {
    const x = random() < 0.5 ? 12 : arena.width - 12,
      y = 140 + random() * Math.max(1, arena.height - 240),
      packId = arena.nextId;
    for (let n = 0; n < 4; n++)
      arena.enemies.push({
        id: arena.nextId++,
        x: x + (n % 2) * 18,
        y: y + Math.floor(n / 2) * 20,
        hp: n === 0 ? 22 : 8,
        kind: n === 0 ? 2 : n % 2,
        leader: n === 0,
        packId,
      });
    arena.packTimer = arena.encounter === "boss" ? 25 : 45;
    events.push({
      type: "warning",
      message: "저주 군집 출현 · 보라색 범위를 피하세요",
    });
  }
  const boss = arena.enemies.find((e) => e.boss && e.hp > 0);
  if (boss) {
    boss.phase = boss.hp < boss.maxHp * 0.5 ? 2 : 1;
    arena.patternTimer -= dt;
    if (arena.patternTimer <= 0) {
      const type = ["blast", "nova", "charge"][arena.patternIndex++ % 3];
      arena.patternTimer = boss.phase === 2 ? 3.2 : 4.8;
      const hazard = {
        id: arena.nextId++,
        type,
        delay: 1.25,
        life: 0.35,
        x: type === "blast" ? p.x : boss.x,
        y: type === "blast" ? p.y : boss.y,
        radius: 48,
        tx: p.x,
        ty: p.y,
        active: false,
      };
      arena.hazards.push(hazard);
      events.push({
        type: "warning",
        message: {
          blast: "붕괴 예고 · 원 밖으로 이동!",
          nova: "탄막 예고 · 탄 사이로 회피!",
          charge: "돌진 예고 · 직선에서 벗어나세요!",
        }[type],
      });
    }
  }
  for (const h of arena.hazards) {
    h.delay -= dt;
    if (h.delay <= 0 && !h.active) {
      h.active = true;
      if (h.type === "nova") {
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5;
          arena.enemyShots.push({
            id: arena.nextId++,
            x: h.x,
            y: h.y,
            vx: Math.cos(angle) * 95,
            vy: Math.sin(angle) * 95,
            life: 5,
          });
        }
      } else if (h.type === "charge" && boss) {
        boss.dash = { x: h.tx, y: h.ty, remaining: 0.45 };
        if (lineDistance(p, { x: h.x, y: h.y }, { x: h.tx, y: h.ty }) < 22)
          hitPlayer(arena, stats, 22, events);
      } else if (
        h.type === "blast" &&
        Math.hypot(p.x - h.x, p.y - h.y) < h.radius
      )
        hitPlayer(arena, stats, 24, events);
    }
    if (h.active) h.life -= dt;
  }
  if (boss?.dash) {
    const d = boss.dash;
    boss.x += (d.x - boss.x) * Math.min(1, dt * 12);
    boss.y += (d.y - boss.y) * Math.min(1, dt * 12);
    d.remaining -= dt;
    if (d.remaining <= 0) boss.dash = null;
  }
  for (const shot of arena.enemyShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    if (Math.hypot(shot.x - p.x, shot.y - p.y) < 17) {
      hitPlayer(arena, stats, 14, events);
      shot.life = 0;
    }
  }
  arena.hazards = arena.hazards.filter((h) => h.life > 0);
  arena.enemyShots = arena.enemyShots.filter((s) => s.life > 0);
}
