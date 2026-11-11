import { describe, expect, it } from "vitest";
import { createStore } from "../../src/state/store.js";
import { saveState, readSave, hydrateState } from "../../src/state/persistence.js";
import { beginCombat, finishCombat } from "../../src/systems/combatLifecycle.js";
import { addReward } from "../../src/systems/survivalCombat.js";
import { ensureMarket, bidAuction, tickMarket, claimDelivery } from "../../src/systems/market.js";

function storage() {
  const entries = new Map();
  let fail = false;
  return {
    setFail(value) { fail = value; },
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) {
      if (fail) throw new Error("quota exceeded");
      entries.set(key, value);
    },
  };
}
function restore(disk) {
  return hydrateState(readSave(disk).state, createStore().getState());
}
function commit(state, disk, action) {
  const candidate = structuredClone(state);
  action(candidate);
  const result = saveState(candidate, disk);
  if (result.ok) Object.assign(state, candidate);
  return result;
}

describe("P0 injected write failure boundaries", () => {
  it("preserves auction escrow and delivery on failed settlement write", () => {
    const disk = storage();
    const state = createStore().getState();
    state.currency.gold = 1000;
    ensureMarket(state, 1000);
    const auction = state.market.auctions[0];
    expect(bidAuction(state, auction.id, true, 1001).ok).toBe(true);
    expect(saveState(state, disk).ok).toBe(true);
    const snapshot = JSON.stringify(state);
    disk.setFail(true);
    expect(commit(state, disk, s => tickMarket(s, 200000)).ok).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
    disk.setFail(false);
    expect(commit(state, disk, s => tickMarket(s, 200000)).ok).toBe(true);
    expect(restore(disk).market.deliveries).toHaveLength(1);
  });

  it("does not expose a claimed item when the claim write fails", () => {
    const disk = storage();
    const state = createStore().getState();
    state.currency.gold = 1000;
    ensureMarket(state, 1000);
    expect(bidAuction(state, state.market.auctions[0].id, true, 1001).ok).toBe(true);
    expect(saveState(state, disk).ok).toBe(true);
    const id = state.market.deliveries[0].id;
    disk.setFail(true);
    expect(commit(state, disk, s => claimDelivery(s, id)).ok).toBe(false);
    expect(state.inventory).toHaveLength(0);
    expect(state.market.deliveries).toHaveLength(1);
    disk.setFail(false);
    expect(commit(state, disk, s => claimDelivery(s, id)).ok).toBe(true);
    expect(restore(disk).inventory).toHaveLength(1);
  });

  it("does not publish combat rewards when final settlement cannot persist", () => {
    const disk = storage();
    const state = createStore().getState();
    expect(commit(state, disk, s => beginCombat(s)).ok).toBe(true);
    addReward(state.combatSession, { gold: 23, exp: 9 });
    expect(saveState(state, disk).ok).toBe(true);
    disk.setFail(true);
    expect(commit(state, disk, s => finishCombat(s, "interrupted")).ok).toBe(false);
    expect(state.combatSession).not.toBeNull();
    expect(state.currency.gold).toBe(0);
    disk.setFail(false);
    expect(commit(state, disk, s => finishCombat(s, "interrupted")).ok).toBe(true);
    const recovered = restore(disk);
    expect(recovered.combatSession).toBeNull();
    expect(recovered.currency.gold).toBe(23);
    expect(recovered.character.exp).toBe(9);
  });

  it("migrates a legacy save without losing the original backup", () => {
    const disk = storage();
    const original = JSON.stringify({ currency: { gold: 287 }, progression: { bossWins: 2 } });
    disk.setItem("claude_game_save_v1", original);
    const state = restore(disk);
    expect(saveState(state, disk).ok).toBe(true);
    expect(disk.getItem("claude_game_save_v1_legacy_backup")).toBe(original);
    expect(restore(disk).currency.gold).toBe(287);
    expect(restore(disk).progression.bossWins).toBe(2);
  });
});
