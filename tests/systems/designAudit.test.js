import { describe, it, expect } from "vitest";
import { createStore } from "../../src/state/store.js";
import {
  strikeIdleEnemy,
  advanceIdleEnemy,
} from "../../src/systems/idleEffects.js";
import { computeCombatStats } from "../../src/systems/effectiveStats.js";
import { unequipItem, recordLoot } from "../../src/systems/items.js";
import { createArena, resizeArena } from "../../src/systems/arena.js";
import { arenaBounds, bossLayout } from "../../src/systems/arenaLayout.js";
import { cubePreview } from "../../src/ui/ExpansionPanel.js";
import { renderTab } from "../../src/ui/BottomPanel.js";
const item = (id, grade = "normal") => ({
  id,
  name: id,
  grade,
  slot: "weapon",
  identified: true,
  statBonus: { atk: 2, def: 1 },
  sockets: [],
});
describe("설계 재감사 회귀", () => {
  it("방치 한기 저주는 적의 공격 빈도를 낮추고 4초 후 해제된다", () => {
    const c = createStore().getState().character,
      stats = computeCombatStats(c),
      normal = { hp: 1000 },
      chilled = { hp: 1000 };
    stats.curse = "chill";
    stats.curseLevel = 3;
    strikeIdleEnemy(chilled, stats, () => 1);
    let normalDamage = 0,
      chilledDamage = 0;
    for (let i = 0; i < 80; i++) {
      normalDamage += advanceIdleEnemy(normal, 50, stats);
      chilledDamage += advanceIdleEnemy(chilled, 50, stats);
    }
    expect(chilledDamage).toBeLessThan(normalDamage);
    advanceIdleEnemy(chilled, 50, stats);
    expect(chilled.curseTimer).toBe(0);
  });
  it("분쇄 저주는 명중 이후 피해를 늘리고 흡혈은 남은 적 체력만 반영한다", () => {
    const stats = computeCombatStats(createStore().getState().character);
    Object.assign(stats, {
      crit: 0,
      curse: "frailty",
      curseLevel: 3,
      lifeSteal: 0.1,
    });
    const enemy = { hp: 100 };
    const first = strikeIdleEnemy(enemy, stats, () => 1),
      second = strikeIdleEnemy(enemy, stats, () => 1);
    expect(second.damage).toBeGreaterThan(first.damage);
    enemy.hp = 1;
    expect(strikeIdleEnemy(enemy, stats, () => 1).healing).toBe(0.1);
  });
  it("가방으로 옮긴 장비가 유지되며 가방이 가득 차면 장착을 유지한다", () => {
    const s = createStore().getState();
    s.character.equippedItems = [item("gear")];
    expect(unequipItem(s, "gear").ok).toBe(true);
    expect(s.inventory[0].id).toBe("gear");
    expect(unequipItem(s, "gear").ok).toBe(false);
    s.character.equippedItems = [item("keep")];
    s.inventory = Array.from({ length: 30 }, (_, i) => item(String(i)));
    expect(unequipItem(s, "keep").ok).toBe(false);
    expect(s.character.equippedItems[0].id).toBe("keep");
  });
  it("미감정 희귀 드롭과 자동 환산도 정확한 획득 알림을 남긴다", () => {
    const s = createStore().getState(),
      i = { ...item("rare", "rare"), identified: false };
    recordLoot(s, i);
    expect(s.lootNotice.message).toContain("감정");
    recordLoot(s, i, { convertedToGold: 40 });
    expect(s.lootNotice.message).toContain("40G 환산");
    recordLoot(s, item("normal"));
    expect(s.lootNotice.id).toBe("rare");
  });
  it("합성 미리보기는 소켓/미감정품을 제외한 실제 첫 3개를 보여준다", () => {
    const s = createStore().getState();
    s.inventory = [
      { ...item("소켓 장비"), sockets: ["ember"] },
      { ...item("미감정"), identified: false },
      item("재료 A"),
      item("재료 B"),
      item("재료 C"),
      item("남길 장비"),
    ];
    const text = cubePreview(s, "normal");
    expect(text).toContain("재료 A + 재료 B + 재료 C");
    expect(text).not.toContain("남길 장비");
    expect(text).toContain("30G → 고급 무기");
  });
  it("전투 크기 변경 시 보스/탄막/예고/돌진 목적지가 함께 이동한다", () => {
    const a = createArena(500, 800, { encounter: "boss" });
    a.enemies[0].dash = { x: 400, y: 600 };
    a.hazards = [{ x: 100, y: 200, tx: 400, ty: 600 }];
    a.enemyShots = [{ x: 200, y: 400 }];
    resizeArena(a, 250, 400);
    const y = (value) => 210 + ((value - 210) * 150) / 550;
    expect(a.enemies[0].x).toBe(125);
    expect(a.enemies[0].dash.x).toBe(200);
    expect(a.enemies[0].dash.y).toBeCloseTo(y(600));
    expect(a.hazards[0].ty).toBeCloseTo(y(600));
    expect(a.enemyShots[0].y).toBeCloseTo(y(400));
  });
  it("가로 화면에서도 보스와 플레이어가 HUD 아래 전투 영역에 있다", () => {
    const a = createArena(520, 390, { encounter: "boss" }),
      bounds = arenaBounds(520, 390, "boss"),
      boss = bossLayout(520, 390);
    expect(boss.y - 34).toBeGreaterThan(bounds.top);
    expect(a.player.y + 24).toBeLessThan(390);
    expect(boss.y + boss.radius).toBeLessThan(390);
  });
  it("골드로 환산된 미감정 가챠 결과에는 실행 불가능한 감정 버튼이 없다", () => {
    const s = createStore().getState();
    s.lastPurchase = {
      item: { ...item("x", "rare"), identified: false },
      destination: "40G 환산",
    };
    expect(renderTab("shop", s)).not.toContain('data-action="identify"');
    s.inventory = [s.lastPurchase.item];
    expect(renderTab("shop", s)).toContain('data-action="identify"');
  });
});
