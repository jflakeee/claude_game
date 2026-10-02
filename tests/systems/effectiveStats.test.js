import { describe, it, expect } from 'vitest';
import { computeEffectiveStats } from '../../src/systems/effectiveStats.js';

function baseCharacter() {
  return {
    stats: { atk: 100, def: 50 },
    equippedItems: [],
    skills: {},
  };
}

describe('computeEffectiveStats', () => {
  it('장비도 스킬도 없으면 기본 스탯을 그대로 반환한다', () => {
    expect(computeEffectiveStats(baseCharacter())).toEqual({ atk: 100, def: 50 });
  });

  it('장비의 statBonus를 기본 스탯에 더한다', () => {
    const character = baseCharacter();
    character.equippedItems = [
      { statBonus: { atk: 10 } },
      { statBonus: { atk: 5, def: 3 } },
    ];
    expect(computeEffectiveStats(character)).toEqual({ atk: 115, def: 53 });
  });

  it('장비 보너스를 더한 뒤 스킬 배율을 곱한다', () => {
    const character = baseCharacter();
    character.equippedItems = [{ statBonus: { atk: 10 } }];
    character.skills = { power_strike: 1 };
    // (100 + 10) * 1.1 = 121
    expect(computeEffectiveStats(character)).toEqual({ atk: 121, def: 50 });
  });
});
