import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../src/state/store.js';

describe('createStore', () => {
  it('기본 상태에 character/currency/inventory/settings/runState를 포함한다', () => {
    const store = createStore();
    const state = store.getState();
    expect(state.character.level).toBe(1);
    expect(state.currency.gold).toBe(0);
    expect(state.inventory).toEqual([]);
    expect(state.scrapbook).toEqual([]);
    expect(state.settings).toEqual({ autoEquipMinGrade: 'normal' });
    expect(state.runState.mode).toBe('idle');
  });

  it('setState는 상태를 병합하고 구독자에게 알린다', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ currency: { gold: 50 } });

    expect(store.getState().currency).toEqual({ gold: 50 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notify는 상태 변경 없이도 구독자를 호출한다', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.notify();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe가 반환한 함수로 구독을 해제할 수 있다', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.notify();

    expect(listener).not.toHaveBeenCalled();
  });
});
