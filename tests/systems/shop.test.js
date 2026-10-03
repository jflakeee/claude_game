import { describe, it, expect } from 'vitest';
import { pullGacha, GACHA_COST } from '../../src/systems/shop.js';

function baseArgs(overrides = {}) {
  return {
    character: { equippedItems: [] },
    currency: { gold: 100 },
    inventory: [],
    scrapbook: [],
    autoEquipMinGrade: 'epic',
    randomFn: () => 0,
    ...overrides,
  };
}

describe('pullGacha', () => {
  it('골드가 부족하면 실패하고 골드를 차감하지 않는다', () => {
    const args = baseArgs({ currency: { gold: 5 } });
    const result = pullGacha(args);
    expect(result).toEqual({ success: false, item: null });
    expect(args.currency.gold).toBe(5);
  });

  it('성공하면 GACHA_COST만큼 골드를 차감하고 아이템을 생성한다', () => {
    const args = baseArgs();
    const result = pullGacha(args);
    expect(result.success).toBe(true);
    expect(args.currency.gold).toBe(100 - GACHA_COST);
    expect(result.item.grade).toBe('normal');
  });

  it('자동장착 기준을 만족하면 인벤토리 대신 장착된다', () => {
    const args = baseArgs({ autoEquipMinGrade: 'normal' });
    const result = pullGacha(args);
    expect(result.autoEquipResult.equipped).toBe(true);
    expect(args.inventory).toHaveLength(0);
  });

  it('자동장착으로 기존 장비가 교체되면 scrapbook으로 회수된다', () => {
    const existing = { id: 'old', name: '기존 장비', grade: 'normal', statBonus: {}, slot: 'weapon' };
    const args = baseArgs({
      character: { equippedItems: [existing] },
      autoEquipMinGrade: 'normal',
    });

    const result = pullGacha(args);

    expect(result.autoEquipResult.equipped).toBe(true);
    expect(result.autoEquipResult.replaced).toBe(existing);
    expect(args.scrapbook).toContainEqual(existing);
    expect(args.character.equippedItems).toEqual([result.item]);
  });
});
