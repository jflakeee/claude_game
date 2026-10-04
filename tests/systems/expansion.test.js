import { describe, it, expect } from "vitest";
import { createStore } from "../../src/state/store.js";
import { hydrateState } from "../../src/state/persistence.js";
import {
  identifyItem,
  socketRune,
  cubeUpgrade,
  rerollItem,
  salvageItem,
  transmuteRune,
  awardMaterials,
} from "../../src/systems/crafting.js";
import {
  ensureMarket,
  tickMarket,
  bidAuction,
  claimDelivery,
  listAuction,
  cancelAuction,
  buyStock,
  sellItem,
  buyBack,
} from "../../src/systems/market.js";
import { learnOrLevelSkill } from "../../src/data/skills.js";
import { computeCombatStats } from "../../src/systems/effectiveStats.js";
import { shouldAutoEquip } from "../../src/systems/autoEquip.js";
import {
  beginCombat,
  finishCombat,
} from "../../src/systems/combatLifecycle.js";
import { createArena, stepArena } from "../../src/systems/arena.js";
import { rollItem } from "../../src/systems/items.js";
import { rollGrade, GRADE_WEIGHTS } from "../../src/data/dropTable.js";
const item = (id, grade = "normal") => ({
  id,
  name: "시험 장비",
  grade,
  identified: true,
  slot: "weapon",
  sockets: [],
  socketCount: 2,
  statBonus: { atk: 2, def: 1 },
});
function state() {
  const s = createStore().getState();
  s.currency.gold = 1000;
  s.materials = { ember: 6, frost: 6, ward: 6, dust: 10 };
  return s;
}
describe("제작·감정", () => {
  it("세트/고유 드롭 경계와 등급 확률 합계가 정확하다", () => {
    expect(Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(rollGrade(() => 0.98)).toBe("set");
    expect(rollGrade(() => 0.999)).toBe("unique");
  });
  it("세트 2/3부위와 고유 효과가 저장 후에도 적용된다", () => {
    const s = state();
    s.character.equippedItems = ["weapon", "armor", "charm"].map((slot) =>
      rollItem(() => 0.5, { grade: "set", slot, identified: true }),
    );
    const stats = computeCombatStats(s.character);
    expect(stats.setPieces).toBe(3);
    expect(stats.regen).toBe(1.5);
    expect(stats.atk).toBe(41);
    s.character.equippedItems[2] = rollItem(() => 0.5, {
      grade: "unique",
      slot: "charm",
      identified: true,
    });
    const loaded = hydrateState(
      JSON.parse(JSON.stringify(s)),
      createStore().getState(),
    );
    const next = computeCombatStats(loaded.character);
    expect(next.setPieces).toBe(2);
    expect(next.crit).toBeCloseTo(0.15);
    expect(next.regen).toBe(0);
    expect(loaded.character.equippedItems).toHaveLength(3);
  });
  it("영웅 3개를 세트로 승급하고 최고 고유 등급은 소비하지 않는다", () => {
    const s = state();
    s.inventory = ["a", "b", "c"].map((id) => item(id, "epic"));
    expect(cubeUpgrade(s, "epic", () => 0.5).ok).toBe(true);
    expect(s.inventory[0].setId).toBe("starlight");
    s.inventory = ["a", "b", "c"].map((id) => item(id, "unique"));
    const gold = s.currency.gold;
    expect(cubeUpgrade(s, "unique").ok).toBe(false);
    expect(s.currency.gold).toBe(gold);
    expect(s.inventory).toHaveLength(3);
  });
  it("미감정 장비는 자동 장착하지 않으며 감정비 부족 시 상태 유지", () => {
    const s = state(),
      i = item("sealed", "rare");
    i.identified = false;
    s.inventory = [i];
    s.currency.gold = 0;
    expect(shouldAutoEquip(i, [], "normal")).toBe(false);
    expect(identifyItem(s, i.id).ok).toBe(false);
    expect(i.identified).toBe(false);
    s.currency.gold = 30;
    expect(identifyItem(s, i.id, () => 0).ok).toBe(true);
    expect(i.affix.name).toBe("맹공");
    expect(s.currency.gold).toBe(0);
  });
  it("룬 순서가 일치해야 룬워드가 완성되고 추가 삽입은 차감하지 않는다", () => {
    const s = state();
    s.inventory = [item("w")];
    socketRune(s, "w", "ember");
    socketRune(s, "w", "ember");
    expect(s.inventory[0].runeword).toBe("cinder");
    expect(s.inventory[0].statBonus.atk).toBe(11);
    const count = s.materials.ember;
    expect(socketRune(s, "w", "ember").ok).toBe(false);
    expect(s.materials.ember).toBe(count);
  });
  it("역순 조합은 룬워드가 되지 않는다", () => {
    const s = state();
    s.inventory = [item("w")];
    socketRune(s, "w", "ward");
    socketRune(s, "w", "frost");
    expect(s.inventory[0].runeword).toBeNull();
  });
  it("소켓 없는 감정된 3개만 합성하고 골드가 부족하면 재료 보존", () => {
    const s = state();
    s.inventory = ["a", "b", "c"].map((id) => item(id));
    s.currency.gold = 0;
    expect(cubeUpgrade(s, "normal").ok).toBe(false);
    expect(s.inventory).toHaveLength(3);
    s.currency.gold = 30;
    expect(cubeUpgrade(s, "normal", () => 0).ok).toBe(true);
    expect(s.inventory).toHaveLength(1);
    expect(s.inventory[0].grade).toBe("magic");
    expect(s.currency.gold).toBe(0);
  });
  it("재추첨은 기존 옵션을 교체하고 소켓 보너스를 중복 가산하지 않는다", () => {
    const s = state();
    s.inventory = [item("w", "magic")];
    socketRune(s, "w", "ember");
    rerollItem(s, "w", () => 0);
    const atk = s.inventory[0].statBonus.atk;
    rerollItem(s, "w", () => 0);
    expect(s.inventory[0].statBonus.atk).toBe(atk);
    expect(s.inventory[0].sockets).toEqual(["ember"]);
    expect(s.materials.dust).toBe(4);
  });
  it("분해/룬 변환의 재료 소모가 정확하다", () => {
    const s = state();
    s.inventory = [item("w", "epic")];
    salvageItem(s, "w");
    expect(s.materials.dust).toBe(14);
    transmuteRune(s, "ember");
    expect(s.materials.ember).toBe(3);
    expect(s.materials.frost).toBe(7);
  });
  it("5회 처치마다 룬 1개를 지급한다", () => {
    const s = state();
    awardMaterials(s, 15);
    expect(s.materials.ember).toBe(7);
    expect(s.materials.frost).toBe(7);
    expect(s.materials.ward).toBe(7);
  });
});
describe("NPC 거래와 경매 예치금", () => {
  function auction(s) {
    ensureMarket(s, 1000);
    return s.market.auctions[0];
  }
  it("골드 부족 구매는 재고와 골드를 유지한다", () => {
    const s = state();
    ensureMarket(s, 1000);
    s.currency.gold = 0;
    const stock = s.market.stock.length;
    expect(buyStock(s, s.market.stock[0].id).ok).toBe(false);
    expect(s.market.stock).toHaveLength(stock);
  });
  it("매각 후 되사기는 같은 아이템과 골드를 복구한다", () => {
    const s = state();
    s.inventory = [item("w")];
    sellItem(s, "w");
    expect(s.currency.gold).toBeGreaterThan(1000);
    buyBack(s, s.market.buyback[0].id);
    expect(s.currency.gold).toBe(1000);
    expect(s.inventory[0].id).toBe("w");
  });
  it("NPC 경쟁 입찰 시 예치금을 정확히 1회 환불한다", () => {
    const s = state(),
      a = auction(s);
    a.npcLimit = 999;
    bidAuction(s, a.id, false, 1001);
    expect(s.currency.gold).toBeLessThan(1000);
    tickMarket(s, 20000);
    expect(s.currency.gold).toBe(1000);
    tickMarket(s, 21000);
    expect(s.currency.gold).toBe(1000);
    expect(a.highest).toBe("npc");
  });
  it("입찰 후 즉시 구매는 차액만 차감하며 중복 수령 불가", () => {
    const s = state(),
      a = auction(s),
      price = a.buyout;
    bidAuction(s, a.id, false, 1001);
    bidAuction(s, a.id, true, 1002);
    expect(s.currency.gold).toBe(1000 - price);
    const id = s.market.deliveries[0].id;
    expect(claimDelivery(s, id).ok).toBe(true);
    expect(claimDelivery(s, id).ok).toBe(false);
    expect(s.inventory).toHaveLength(1);
  });
  it("가방이 가득 차면 낙찰품이 보관함에 유지된다", () => {
    const s = state(),
      a = auction(s);
    bidAuction(s, a.id, true, 1002);
    s.inventory = Array.from({ length: 30 }, (_, i) => item(String(i)));
    const id = s.market.deliveries[0].id;
    expect(claimDelivery(s, id).ok).toBe(false);
    expect(s.market.deliveries).toHaveLength(1);
  });
  it("저장 후 만료시각을 넘겨 접속해도 예정 NPC 입찰/환불을 재생한다", () => {
    const s = state(),
      a = auction(s);
    a.npcLimit = 999;
    bidAuction(s, a.id, false, 1001);
    const loaded = hydrateState(
      JSON.parse(JSON.stringify(s)),
      createStore().getState(),
    );
    tickMarket(loaded, 200000);
    expect(loaded.currency.gold).toBe(1000);
    expect(loaded.market.deliveries).toHaveLength(0);
  });
  it("내 출품이 낙찰되면 5% 수수료 제외 정산, 반복 호출은 추가 지급 없음", () => {
    const s = state();
    s.inventory = [item("w")];
    listAuction(s, "w", 1, 1000);
    const a = s.market.auctions[0];
    a.npcLimit = 999;
    const expected = 995 + Math.floor(a.bid * 0.95);
    tickMarket(s, 100000);
    expect(s.currency.gold).toBe(expected);
    tickMarket(s, 200000);
    expect(s.currency.gold).toBe(expected);
  });
  it("취소는 보관함으로 반환하며 출품비 환불/이중 취소 없음", () => {
    const s = state();
    s.inventory = [item("w")];
    listAuction(s, "w", 3, 1000);
    const id = s.market.auctions[0].id;
    expect(cancelAuction(s, id, 1001).ok).toBe(true);
    expect(s.currency.gold).toBe(995);
    expect(cancelAuction(s, id, 1002).ok).toBe(false);
    expect(s.market.deliveries).toHaveLength(1);
  });
});
describe("심화 성장과 보스", () => {
  it("선행 스킬과 레벨을 충족해야 심화 스킬을 배운다", () => {
    const s = state(),
      c = s.character;
    c.skillPoints = 20;
    c.level = 10;
    expect(learnOrLevelSkill(c, "fury")).toBe(false);
    c.skills = { power_strike: 3, piercing: 1 };
    expect(learnOrLevelSkill(c, "fury")).toBe(true);
    c.activeAura = "fury";
    const stats = computeCombatStats(c);
    expect(stats.aura).toBe("fury");
    expect(stats.synergy).toBeCloseTo(0.09);
  });
  it("미학습 오라 선택 저장본은 전투 효과를 주지 않는다", () => {
    const c = state().character;
    c.activeAura = "fury";
    expect(computeCombatStats(c).aura).toBeNull();
  });
  it("보스 처치 시 보상과 승리 기록을 한 번만 받는다", () => {
    const s = state();
    beginCombat(s, "boss");
    finishCombat(s, "cleared");
    expect(s.progression.bossWins).toBe(1);
    expect(s.currency.gold).toBe(1250);
    finishCombat(s, "cleared");
    expect(s.progression.bossWins).toBe(1);
  });
  it("보스는 3종 패턴을 예고하고 체력 절반에서 2단계로 전환한다", () => {
    const a = createArena(390, 844, { encounter: "boss" });
    a.attack = 999;
    const types = new Set();
    for (let i = 0; i < 400; i++) {
      stepArena(a, 50, { atk: 10, def: 50 });
      a.hazards.forEach((h) => types.add(h.type));
    }
    expect([...types].sort()).toEqual(["blast", "charge", "nova"]);
    a.enemies.find((e) => e.boss).hp = 100;
    stepArena(a, 50, { atk: 10, def: 50 });
    expect(a.enemies.find((e) => e.boss).phase).toBe(2);
  });
  it("폭발 예고 동안 안전하며 범위 밖에서는 피해가 없다", () => {
    const a = createArena(390, 844, { encounter: "boss" });
    a.attack = 999;
    a.spawn = 999;
    a.patternTimer = 0;
    stepArena(a, 50, { atk: 10, def: 0 });
    expect(a.player.hp).toBe(100);
    a.player.x = 20;
    for (let i = 0; i < 30; i++) stepArena(a, 50, { atk: 10, def: 0 });
    expect(a.player.hp).toBe(100);
  });
  it("군집 우두머리 근처에 있을 때만 저주에 걸린다", () => {
    const a = createArena(390, 844);
    a.spawn = 999;
    a.attack = 999;
    a.enemies = [
      {
        id: 1,
        x: a.player.x + 80,
        y: a.player.y,
        hp: 100,
        kind: 2,
        leader: true,
      },
    ];
    stepArena(a, 50, { atk: 10, def: 5 });
    expect(a.playerHex).toBeGreaterThan(0);
    a.enemies = [];
    for (let i = 0; i < 50; i++) stepArena(a, 50, { atk: 10, def: 5 });
    expect(a.playerHex).toBe(0);
  });
});
