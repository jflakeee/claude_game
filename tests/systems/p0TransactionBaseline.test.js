import { describe, it, expect } from "vitest";
import { createStore } from "../../src/state/store.js";
import { readSave, saveState, hydrateState } from "../../src/state/persistence.js";
import { ensureMarket, bidAuction, tickMarket, claimDelivery } from "../../src/systems/market.js";
import { beginCombat, finishCombat } from "../../src/systems/combatLifecycle.js";
import { addReward } from "../../src/systems/survivalCombat.js";

const KEY = "claude_game_save_v1";
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
function state(gold = 1000) {
  const value = createStore().getState();
  value.currency.gold = gold;
  return value;
}
function reopen(storage) {
  return hydrateState(readSave(storage).state, createStore().getState());
}

describe("P0-A transaction safety baseline", () => {
  it("keeps the persisted auction state intact when a settlement write fails", () => {
    const storage = memoryStorage();
    const s = state();
    ensureMarket(s, 1000);
    const auction = s.market.auctions[0];
    expect(bidAuction(s, auction.id, true, 1001).ok).toBe(true);
    expect(saveState(s, storage).ok).toBe(true);
    const previous = storage.getItem(KEY);
    const deliveryCount = s.market.deliveries.length;
    const write = storage.setItem;
    storage.setItem = () => { throw new Error("quota exceeded"); };
    expect(saveState(s, storage)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(storage.getItem(KEY)).toBe(previous);
    storage.setItem = write;
    const restored = reopen(storage);
    expect(restored.market.deliveries).toHaveLength(deliveryCount);
  });

  it("settles an expired NPC auction at most once across a successful reload", () => {
    const storage = memoryStorage();
    const s = state();
    ensureMarket(s, 1000);
    const auction = s.market.auctions[0];
    expect(bidAuction(s, auction.id, false, 1001).ok).toBe(true);
    expect(saveState(s, storage).ok).toBe(true);
    const restored = reopen(storage);
    tickMarket(restored, 200000);
    expect(saveState(restored, storage).ok).toBe(true);
    const once = reopen(storage);
    const gold = once.currency.gold;
    const deliveries = once.market.deliveries.length;
    tickMarket(once, 200001);
    expect(once.currency.gold).toBe(gold);
    expect(once.market.deliveries).toHaveLength(deliveries);
  });

  it("does not claim the same delivery twice after persistence and reload", () => {
    const storage = memoryStorage();
    const s = state();
    ensureMarket(s, 1000);
    expect(bidAuction(s, s.market.auctions[0].id, true, 1001).ok).toBe(true);
    expect(saveState(s, storage).ok).toBe(true);
    const restored = reopen(storage);
    const deliveryId = restored.market.deliveries[0].id;
    expect(claimDelivery(restored, deliveryId).ok).toBe(true);
    expect(saveState(restored, storage).ok).toBe(true);
    const once = reopen(storage);
    expect(claimDelivery(once, deliveryId).ok).toBe(false);
    expect(once.inventory).toHaveLength(1);
  });

  it("settles an interrupted combat once after reload", () => {
    const storage = memoryStorage();
    const s = state(0);
    beginCombat(s);
    addReward(s.combatSession, { gold: 19, exp: 7 });
    expect(saveState(s, storage).ok).toBe(true);
    const restored = reopen(storage);
    finishCombat(restored, "interrupted");
    expect(saveState(restored, storage).ok).toBe(true);
    const again = reopen(storage);
    expect(again.combatSession).toBeNull();
    expect(again.currency.gold).toBe(19);
    expect(again.character.exp).toBe(7);
  });

  it("rejects a stale writer without overwriting a newer save", () => {
    const storage = memoryStorage();
    const first = state();
    expect(saveState(first, storage).ok).toBe(true);
    const stale = reopen(storage);
    first.currency.gold += 5;
    expect(saveState(first, storage).ok).toBe(true);
    stale.currency.gold += 50;
    expect(saveState(stale, storage)).toMatchObject({ ok: false, reason: "conflict" });
    expect(reopen(storage).currency.gold).toBe(1005);
  });
});
