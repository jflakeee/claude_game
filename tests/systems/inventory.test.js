import { describe, it, expect } from 'vitest';
import { addItemToInventory, itemGoldValue, INVENTORY_CAPACITY } from '../../src/systems/inventory.js';

const item = (grade) => ({ id: grade, name: grade, grade, statBonus: {}, slot: 'weapon' });

describe('itemGoldValue', () => {
  it('등급별로 정해진 골드 가치를 반환한다', () => {
    expect(itemGoldValue(item('normal'))).toBe(5);
    expect(itemGoldValue(item('magic'))).toBe(15);
    expect(itemGoldValue(item('rare'))).toBe(40);
    expect(itemGoldValue(item('epic'))).toBe(100);
  });
});

describe('addItemToInventory', () => {
  it('이미 자동 장착된 아이템이면 인벤토리에 추가하지 않는다', () => {
    const inventory = [];
    const currency = { gold: 0 };
    const result = addItemToInventory(inventory, item('normal'), currency, true);
    expect(result).toEqual({ added: false, convertedToGold: 0 });
    expect(inventory).toEqual([]);
  });

  it('공간이 있으면 인벤토리에 추가한다', () => {
    const inventory = [];
    const currency = { gold: 0 };
    const result = addItemToInventory(inventory, item('normal'), currency, false);
    expect(result).toEqual({ added: true, convertedToGold: 0 });
    expect(inventory).toHaveLength(1);
  });

  it('인벤토리가 가득 차면 골드로 환산해 흡수한다', () => {
    const inventory = Array.from({ length: INVENTORY_CAPACITY }, () => item('normal'));
    const currency = { gold: 0 };
    const result = addItemToInventory(inventory, item('epic'), currency, false);
    expect(result).toEqual({ added: false, convertedToGold: 100 });
    expect(currency.gold).toBe(100);
    expect(inventory).toHaveLength(INVENTORY_CAPACITY);
  });
});
