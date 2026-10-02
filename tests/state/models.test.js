import { describe, it, expect } from 'vitest';
import { createCharacter, createItem, createCurrency, createRunState } from '../../src/state/models.js';

describe('createCharacter', () => {
  it('기본값으로 레벨1, 경험치0, 빈 장비 목록을 가진다', () => {
    const c = createCharacter();
    expect(c.level).toBe(1);
    expect(c.exp).toBe(0);
    expect(c.equippedItems).toEqual([]);
    expect(c.skillPoints).toBe(0);
    expect(c.skills).toEqual({});
    expect(c.stats).toEqual({ atk: 10, def: 5, crit: 0.05 });
  });
});

describe('createItem', () => {
  it('전달한 필드를 그대로 가진 아이템을 만든다', () => {
    const item = createItem({ id: 'i1', name: '녹슨 검', grade: 'normal', statBonus: { atk: 2 }, slot: 'weapon' });
    expect(item).toEqual({ id: 'i1', name: '녹슨 검', grade: 'normal', statBonus: { atk: 2 }, slot: 'weapon' });
  });
});

describe('createCurrency', () => {
  it('기본값 gold 0을 가진다', () => {
    expect(createCurrency()).toEqual({ gold: 0 });
  });
});

describe('createRunState', () => {
  it('기본값 idle 모드, stageIndex 0, distancePx 0을 가진다', () => {
    expect(createRunState()).toEqual({ mode: 'idle', stageIndex: 0, combatTimer: 0, distancePx: 0 });
  });
});
