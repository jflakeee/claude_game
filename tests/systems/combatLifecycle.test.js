import { describe, it, expect } from "vitest";
import { createStore } from "../../src/state/store.js";
import {
  beginCombat,
  finishCombat,
} from "../../src/systems/combatLifecycle.js";
import { addReward } from "../../src/systems/survivalCombat.js";
import {
  hydrateState,
  saveState,
  loadState,
} from "../../src/state/persistence.js";
const item = {
  id: "loot",
  name: "별빛 지팡이",
  grade: "rare",
  statBonus: { atk: 3, def: 3 },
  slot: "weapon",
};
describe("전투 정산과 재접속", () => {
  it.each(["failed", "escaped", "interrupted", "cleared"])(
    "%s 종료 시 아이템과 재화를 한 번만 받는다",
    (outcome) => {
      const s = createStore().getState();
      beginCombat(s);
      addReward(s.combatSession, { gold: 10, exp: 5, item });
      finishCombat(s, outcome);
      const gold = s.currency.gold;
      expect(gold).toBe(outcome === "cleared" ? 110 : 10);
      expect(s.character.equippedItems).toEqual([item]);
      expect(s.runState.mode).toBe("idle");
      expect(s.combatSession).toBeNull();
      finishCombat(s, outcome);
      expect(s.currency.gold).toBe(gold);
    },
  );
  it("전투 중 저장본 복구 시 처치 보상을 정산하고 두 번째 새로고침은 중복 지급하지 않는다", () => {
    const storage = {
      value: null,
      setItem(k, v) {
        this.value = v;
      },
      getItem() {
        return this.value;
      },
    };
    const s = createStore().getState();
    s.runState.distancePx = 900;
    beginCombat(s);
    addReward(s.combatSession, { gold: 24, exp: 30, item });
    saveState(s, storage);
    const recovered = hydrateState(
      loadState(storage),
      createStore().getState(),
    );
    finishCombat(recovered, "interrupted");
    saveState(recovered, storage);
    expect(recovered.currency.gold).toBe(24);
    expect(recovered.character.exp).toBe(30);
    expect(recovered.runState.distancePx).toBe(900);
    const again = hydrateState(loadState(storage), createStore().getState());
    expect(again.combatSession).toBeNull();
    expect(again.currency.gold).toBe(24);
  });
  it("구형 세이브에 새 설정과 진행 필드를 보충한다", () => {
    const state = hydrateState(
      {
        character: { level: 2 },
        settings: { autoEquipMinGrade: "rare" },
        runState: { stageIndex: 3 },
      },
      createStore().getState(),
    );
    expect(state.settings.sound).toBe(true);
    expect(state.runState.distancePx).toBe(0);
    expect(state.character.stats.atk).toBe(10);
  });
});
