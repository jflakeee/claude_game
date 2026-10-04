import { createCharacter, createCurrency, createRunState } from "./models.js";

export function createStore() {
  const state = {
    character: createCharacter(),
    currency: createCurrency(),
    inventory: [],
    scrapbook: [],
    settings: {
      autoEquipMinGrade: "normal",
      sound: true,
      motion: true,
      notifications: true,
      autoProgress: true,
    },
    runState: createRunState(),
    combatSession: null,
    lastResult: null,
    materials: { ember: 1, frost: 1, ward: 1, dust: 0 },
    progression: { kills: 0, bossWins: 0 },
    market: {
      stock: [],
      buyback: [],
      auctions: [],
      deliveries: [],
      history: [],
      refreshedAt: 0,
    },
  };
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(partial) {
    Object.assign(state, partial);
    notify();
  }

  function notify() {
    for (const listener of listeners) listener(state);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, notify, subscribe };
}
