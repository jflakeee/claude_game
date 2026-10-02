import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearState } from '../../src/state/persistence.js';

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
