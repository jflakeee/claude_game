import { describe, it, expect } from 'vitest';
import {
  createCombatSession,
  tickCombat,
  addReward,
  settleCombat,
  COMBAT_DURATION_MS,
} from '../../src/systems/survivalCombat.js';

describe('tickCombat', () => {
  it('플레이어 체력이 남아있고 시간이 안 찼으면 outcome이 null이다', () => {
    const session = createCombatSession(0);
    tickCombat(session, 1000, 100);
    expect(session.outcome).toBeNull();
    expect(session.elapsedMs).toBe(1000);
  });

  it('경과 시간이 COMBAT_DURATION_MS 이상이면 cleared가 된다', () => {
    const session = createCombatSession(0);
    tickCombat(session, COMBAT_DURATION_MS, 100);
    expect(session.outcome).toBe('cleared');
  });

  it('체력이 0 이하이면 즉시 failed가 된다', () => {
    const session = createCombatSession(0);
    tickCombat(session, 1000, 0);
    expect(session.outcome).toBe('failed');
  });
});

describe('addReward / settleCombat', () => {
  it('addReward로 누적한 보상을 settleCombat이 재화/캐릭터에 반영한다', () => {
    const session = createCombatSession(0);
    addReward(session, { gold: 10, exp: 5 });
    addReward(session, { gold: 20, exp: 5, item: { id: 'x' } });

    const currency = { gold: 0 };
    const character = { exp: 0 };
    const result = settleCombat(session, currency, character);

    expect(currency.gold).toBe(30);
    expect(character.exp).toBe(10);
    expect(result.rewards.items).toEqual([{ id: 'x' }]);
  });

  it('실패(failed)로 끝나도 그때까지 쌓인 보상은 정산된다', () => {
    const session = createCombatSession(0);
    addReward(session, { gold: 5, exp: 1 });
    tickCombat(session, 1000, 0);

    const currency = { gold: 0 };
    const character = { exp: 0 };
    const result = settleCombat(session, currency, character);

    expect(result.outcome).toBe('failed');
    expect(currency.gold).toBe(5);
    expect(character.exp).toBe(1);
  });
});
