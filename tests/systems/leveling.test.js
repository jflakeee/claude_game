import { describe, it, expect } from 'vitest';
import { expThreshold, applyLevelUps } from '../../src/systems/leveling.js';

describe('expThreshold', () => {
  it('레벨 * 50 을 반환한다', () => {
    expect(expThreshold(1)).toBe(50);
    expect(expThreshold(3)).toBe(150);
  });
});

describe('applyLevelUps', () => {
  it('경험치가 기준치 미만이면 레벨업하지 않는다', () => {
    const character = { level: 1, exp: 10, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(false);
    expect(character.level).toBe(1);
    expect(character.exp).toBe(10);
    expect(character.skillPoints).toBe(0);
  });

  it('경험치가 기준치 이상이면 레벨업하고 스킬 포인트를 1 지급한다', () => {
    const character = { level: 1, exp: 50, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(true);
    expect(character.level).toBe(2);
    expect(character.exp).toBe(0);
    expect(character.skillPoints).toBe(1);
  });

  it('한 번에 여러 레벨업이 가능하면 반복해서 처리한다', () => {
    const character = { level: 1, exp: 50 + 100 + 5, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(true);
    expect(character.level).toBe(3);
    expect(character.exp).toBe(5);
    expect(character.skillPoints).toBe(2);
  });
});
