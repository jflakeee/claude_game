import { describe, it, expect } from 'vitest';
import { SKILL_DEFS, learnOrLevelSkill, applySkillEffects } from '../../src/data/skills.js';

function characterWithPoints(points) {
  return { stats: { atk: 100, def: 50 }, skills: {}, skillPoints: points };
}

describe('SKILL_DEFS', () => {
  it('기초 패시브와 심화 스킬, 오라, 저주 8종을 정의한다', () => {
    expect(Object.keys(SKILL_DEFS)).toEqual(['power_strike', 'iron_skin','piercing','vampirism','frailty','chill','fury','renewal']);
  });
});

describe('learnOrLevelSkill', () => {
  it('스킬 포인트가 있으면 레벨을 1 올리고 포인트를 소모한다', () => {
    const character = characterWithPoints(1);
    const result = learnOrLevelSkill(character, 'power_strike');
    expect(result).toBe(true);
    expect(character.skills.power_strike).toBe(1);
    expect(character.skillPoints).toBe(0);
  });

  it('스킬 포인트가 없으면 아무것도 하지 않고 false를 반환한다', () => {
    const character = characterWithPoints(0);
    const result = learnOrLevelSkill(character, 'power_strike');
    expect(result).toBe(false);
    expect(character.skills.power_strike).toBeUndefined();
  });

  it('최대 레벨에 도달하면 더 이상 올릴 수 없다', () => {
    const character = characterWithPoints(10);
    character.skills.power_strike = SKILL_DEFS.power_strike.maxLevel;
    const result = learnOrLevelSkill(character, 'power_strike');
    expect(result).toBe(false);
    expect(character.skillPoints).toBe(10);
  });

  it('정의되지 않은 스킬 id는 에러를 던진다', () => {
    const character = characterWithPoints(1);
    expect(() => learnOrLevelSkill(character, 'unknown')).toThrow('Unknown skill: unknown');
  });
});

describe('applySkillEffects', () => {
  it('스킬이 없으면 기본 스탯을 그대로 반환한다', () => {
    const character = characterWithPoints(0);
    expect(applySkillEffects(character)).toEqual({ atk: 100, def: 50 });
  });

  it('power_strike 레벨만큼 공격력을 10%씩 곱연산으로 올린다', () => {
    const character = characterWithPoints(0);
    character.skills.power_strike = 2;
    expect(applySkillEffects(character)).toEqual({ atk: 120, def: 50 });
  });

  it('iron_skin 레벨만큼 방어력을 10%씩 곱연산으로 올린다', () => {
    const character = characterWithPoints(0);
    character.skills.iron_skin = 1;
    expect(applySkillEffects(character)).toEqual({ atk: 100, def: 55 });
  });
});
