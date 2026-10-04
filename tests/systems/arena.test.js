import { describe, it, expect } from "vitest";
import { createArena, stepArena } from "../../src/systems/arena.js";
const stats = { atk: 14, def: 6, crit: 0 };
describe("실제 생존 전투", () => {
  it("적과 떨어져 있으면 시간만으로 피해를 받지 않는다", () => {
    const a = createArena(390, 844);
    a.spawn = 999;
    for (let i = 0; i < 200; i++) stepArena(a, 50, stats);
    expect(a.player.hp).toBe(100);
  });
  it("접촉하면 피해, 방어력이 높으면 경감, 무적 시간에는 중복 피해 없음", () => {
    const run = (def) => {
      const a = createArena(390, 844);
      a.spawn = 999;
      a.attack = 999;
      a.enemies = [{ id: 1, x: a.player.x, y: a.player.y, hp: 999, kind: 0 }];
      stepArena(a, 50, { ...stats, def });
      return a;
    };
    const weak = run(0),
      strong = run(10);
    expect(strong.player.hp).toBeGreaterThan(weak.player.hp);
    const before = weak.player.hp;
    stepArena(weak, 50, { ...stats, def: 0 });
    expect(weak.player.hp).toBeGreaterThanOrEqual(before);
  });
  it("자동 공격으로 실제 적을 처치한다", () => {
    const a = createArena(390, 844);
    a.spawn = 999;
    a.enemies = [{ id: 1, x: a.player.x + 80, y: a.player.y, hp: 10, kind: 0 }];
    const events = [];
    for (let i = 0; i < 30; i++)
      events.push(...stepArena(a, 50, stats, {}, () => 0.9));
    expect(events.some((e) => e.type === "kill")).toBe(true);
    expect(a.enemies).toHaveLength(0);
  });
  it("키보드나 드래그 입력으로 경계 밖을 벗어나지 않는다", () => {
    const a = createArena(390, 640);
    a.spawn = 999;
    for (let i = 0; i < 200; i++) stepArena(a, 50, stats, { x: 1, y: -1 });
    expect(a.player.x).toBe(370);
    expect(a.player.y).toBe(140); // Keep the hero below the health HUD.
  });
  it("레벨 1 캐릭터도 이동하며 3분 생존할 수 있다", () => {
    const a = createArena(390, 844);
    let seed = 17,
      kills = 0;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 3600; i++) {
      const t = i * 0.05,
        tx = 195 + 110 * Math.cos(t * 0.22),
        ty = 460 + 220 * Math.sin(t * 0.22);
      const events = stepArena(
        a,
        50,
        { atk: 10, def: 5, crit: 0.05 },
        { x: (tx - a.player.x) / 20, y: (ty - a.player.y) / 20 },
        random,
      );
      kills += events.filter((e) => e.type === "kill").length;
      expect(a.player.hp).toBeGreaterThan(0);
    }
    expect(kills).toBeGreaterThan(30);
  });
});
