import { describe, it, expect } from 'vitest';
import { restoreCost, restoreFromScrapbook } from '../../src/systems/scrapbook.js';

const item = (id, grade, slot = 'weapon') => ({ id, name: id, grade, statBonus: {}, slot });

describe('restoreCost', () => {
  it('등급별 골드 가치를 그대로 반환한다', () => {
    expect(restoreCost(item('a', 'normal'))).toBe(5);
    expect(restoreCost(item('b', 'epic'))).toBe(100);
  });
});

describe('restoreFromScrapbook', () => {
  it('스크랩북에 없는 아이템이면 실패한다', () => {
    const result = restoreFromScrapbook([], { equippedItems: [] }, { gold: 1000 }, 'missing');
    expect(result).toEqual({ restored: false, reason: 'not_found' });
  });

  it('골드가 부족하면 실패하고 골드/스크랩북을 바꾸지 않는다', () => {
    const scrapped = item('s1', 'epic');
    const scrapbook = [scrapped];
    const currency = { gold: 10 };
    const result = restoreFromScrapbook(scrapbook, { equippedItems: [] }, currency, 's1');
    expect(result).toEqual({ restored: false, reason: 'insufficient_gold' });
    expect(currency.gold).toBe(10);
    expect(scrapbook).toHaveLength(1);
  });

  it('성공하면 골드를 소모하고 즉시 재장착하며, 기존 장착 아이템은 스크랩북으로 들어간다', () => {
    const scrapped = item('s1', 'normal');
    const currentlyEquipped = item('cur', 'magic');
    const scrapbook = [scrapped];
    const character = { equippedItems: [currentlyEquipped] };
    const currency = { gold: 100 };

    const result = restoreFromScrapbook(scrapbook, character, currency, 's1');

    expect(result.restored).toBe(true);
    expect(result.cost).toBe(5);
    expect(currency.gold).toBe(95);
    expect(character.equippedItems).toEqual([scrapped]);
    expect(scrapbook).toEqual([currentlyEquipped]);
  });

  it('해당 슬롯에 장착된 장비가 없으면 그냥 장착하고 스크랩북에는 아무것도 추가되지 않는다', () => {
    const scrapped = item('s1', 'normal');
    const scrapbook = [scrapped];
    const character = { equippedItems: [] };
    const currency = { gold: 100 };

    const result = restoreFromScrapbook(scrapbook, character, currency, 's1');

    expect(result.restored).toBe(true);
    expect(character.equippedItems).toEqual([scrapped]);
    expect(scrapbook).toEqual([]);
  });
});
