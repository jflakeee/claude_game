import { describe, it, expect } from 'vitest';
import { statTotal, shouldAutoEquip, autoEquip } from '../../src/systems/autoEquip.js';

const weapon = (grade, atk, slot = 'weapon') => ({ id: `${grade}-${atk}`, name: grade, grade, statBonus: { atk }, slot });

describe('statTotal', () => {
  it('statBonus 값의 합을 반환한다', () => {
    expect(statTotal({ statBonus: { atk: 3, def: 2 } })).toBe(5);
  });
});

describe('shouldAutoEquip', () => {
  it('최소 등급보다 낮으면 장착하지 않는다', () => {
    const dropped = weapon('normal', 10);
    expect(shouldAutoEquip(dropped, [], 'rare')).toBe(false);
  });

  it('같은 슬롯에 장비가 없으면 기준 등급 이상일 때 장착한다', () => {
    const dropped = weapon('rare', 10);
    expect(shouldAutoEquip(dropped, [], 'normal')).toBe(true);
  });

  it('기존 장비보다 스탯 합이 높을 때만 교체한다', () => {
    const current = weapon('normal', 10);
    const worse = weapon('magic', 5);
    const better = weapon('magic', 15);
    expect(shouldAutoEquip(worse, [current], 'normal')).toBe(false);
    expect(shouldAutoEquip(better, [current], 'normal')).toBe(true);
  });
});

describe('autoEquip', () => {
  it('장착 조건을 만족하면 character.equippedItems를 교체하고 replaced를 반환한다', () => {
    const character = { equippedItems: [weapon('normal', 10)] };
    const dropped = weapon('magic', 20);

    const result = autoEquip(dropped, character, 'normal');

    expect(result.equipped).toBe(true);
    expect(result.replaced.grade).toBe('normal');
    expect(character.equippedItems).toEqual([dropped]);
  });

  it('장착 조건을 만족하지 않으면 character를 바꾸지 않는다', () => {
    const existing = weapon('rare', 50);
    const character = { equippedItems: [existing] };
    const dropped = weapon('magic', 5);

    const result = autoEquip(dropped, character, 'normal');

    expect(result.equipped).toBe(false);
    expect(result.replaced).toBeNull();
    expect(character.equippedItems).toEqual([existing]);
  });
});
