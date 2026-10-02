import { createCharacter, createCurrency, createRunState } from './models.js';

export function createStore() {
  const state = {
    character: createCharacter(),
    currency: createCurrency(),
    inventory: [],
    scrapbook: [],
    settings: { autoEquipMinGrade: 'normal' },
    runState: createRunState(),
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
