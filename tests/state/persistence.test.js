import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearState, readSave, hydrateState } from '../../src/state/persistence.js';
import { createStore } from '../../src/state/store.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

describe('persistence', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('저장된 적이 없으면 null을 반환한다', () => {
    expect(loadState(storage)).toBeNull();
  });

  it('saveState로 저장한 값을 loadState로 그대로 불러온다', () => {
    const data = { currency: { gold: 42 } };
    saveState(data, storage);
    expect(loadState(storage)).toEqual(data);
  });

  it('손상된 JSON이면 null을 반환한다', () => {
    storage.setItem('claude_game_save_v1', '{broken');
    expect(loadState(storage)).toBeNull();
  });

  it('clearState로 저장값을 지운다', () => {
    saveState({ currency: { gold: 1 } }, storage);
    clearState(storage);
    expect(loadState(storage)).toBeNull();
  });
});

function createThrowingStorage() {
  return {
    getItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
  };
}

describe('persistence — storage 자체가 실패하는 경우', () => {
  it('loadState는 storage.getItem이 throw해도 null을 반환한다', () => {
    expect(loadState(createThrowingStorage())).toBeNull();
  });

  it('saveState는 storage.setItem이 throw해도 예외를 던지지 않는다', () => {
    expect(() => saveState({ currency: { gold: 1 } }, createThrowingStorage())).not.toThrow();
  });

  it('clearState는 storage.removeItem이 throw해도 예외를 던지지 않는다', () => {
    expect(() => clearState(createThrowingStorage())).not.toThrow();
  });
});

describe('save protection', () => {
  const key = 'claude_game_save_v1';
  it('reports failed writes without advancing revision or losing the previous save', () => {
    const storage = createMemoryStorage();
    const state = createStore().getState();
    expect(saveState(state, storage).ok).toBe(true);
    const before = storage.getItem(key);
    const revision = state.revision;
    storage.setItem = () => { throw new Error('quota'); };
    state.currency.gold = 90;
    expect(saveState(state, storage)).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(state.revision).toBe(revision);
    expect(storage.getItem(key)).toBe(before);
  });
  it('backs up a legacy save before migration and keeps its progress', () => {
    const storage = createMemoryStorage();
    const raw = JSON.stringify({ currency: { gold: 42 }, progression: { firstGrowthComplete: true } });
    storage.setItem(key, raw);
    expect(readSave(storage).status).toBe('legacy');
    const state = hydrateState(loadState(storage), createStore().getState());
    expect(saveState(state, storage)).toMatchObject({ ok: true, revision: 1 });
    expect(storage.getItem(`${key}_legacy_backup`)).toBe(raw);
    expect(loadState(storage)).toMatchObject({ schemaVersion: 1, revision: 1, currency: { gold: 42 }, progression: { firstGrowthComplete: true } });
  });
  it.each(['{broken', '[]', 'null', '{"schemaVersion":99}', '{"schemaVersion":"1"}', '{"schemaVersion":1,"revision":-1}'])('preserves an unreadable or unsupported save: %s', raw => {
    const storage = createMemoryStorage();
    storage.setItem(key, raw);
    expect(['corrupt', 'unsupported']).toContain(readSave(storage).status);
    expect(saveState(createStore().getState(), storage).ok).toBe(false);
    expect(storage.getItem(key)).toBe(raw);
  });
  it('does not migrate if the legacy backup cannot be written', () => {
    const storage = createMemoryStorage();
    const raw = '{"currency":{"gold":42}}';
    storage.setItem(key, raw);
    const write = storage.setItem;
    storage.setItem = (name, value) => { if (name.endsWith('_legacy_backup')) throw new Error('quota'); write(name, value); };
    expect(saveState(hydrateState(loadState(storage), createStore().getState()), storage).ok).toBe(false);
    expect(storage.getItem(key)).toBe(raw);
  });
  it('rejects a stale state after another writer has saved', () => {
    const storage = createMemoryStorage();
    const first = createStore().getState();
    const stale = createStore().getState();
    saveState(first, storage);
    stale.currency.gold = 999;
    expect(saveState(stale, storage)).toMatchObject({ ok: false, reason: 'conflict' });
    expect(loadState(storage).currency.gold).toBe(0);
  });
  it('distinguishes empty storage from unavailable storage', () => {
    expect(readSave(createMemoryStorage()).status).toBe('empty');
    expect(readSave(createThrowingStorage()).status).toBe('unavailable');
  });
});
