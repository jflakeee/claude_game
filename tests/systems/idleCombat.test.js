import { describe, it, expect } from 'vitest';
import {
  createIdleProgress,
  advanceIdleProgress,
  resolveIdleKill,
  STAGE_LENGTH_PX,
} from '../../src/systems/idleCombat.js';

describe('advanceIdleProgress', () => {
  it('이동 거리가 스테이지 길이에 못 미치면 false를 반환한다', () => {
    const progress = createIdleProgress();
    const cleared = advanceIdleProgress(progress, 1000);
    expect(cleared).toBe(false);
    expect(progress.distancePx).toBeGreaterThan(0);
    expect(progress.stageIndex).toBe(0);
  });

  it('누적 거리가 스테이지 길이를 넘으면 다음 스테이지로 넘어가고 거리를 리셋한다', () => {
    const progress = createIdleProgress();
    progress.distancePx = STAGE_LENGTH_PX - 1;
    const cleared = advanceIdleProgress(progress, 1000);
    expect(cleared).toBe(true);
    expect(progress.stageIndex).toBe(1);
    expect(progress.distancePx).toBe(0);
  });
});

describe('resolveIdleKill', () => {
  it('골드/경험치를 지급하고 드롭 아이템을 생성한다', () => {
    const character = { equippedItems: [], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];

    const result = resolveIdleKill({
      character,
      currency,
      inventory,
      autoEquipMinGrade: 'epic',
      randomFn: () => 0,
    });

    expect(currency.gold).toBe(2);
    expect(character.exp).toBe(3);
    expect(result.item.grade).toBe('normal');
    expect(inventory).toHaveLength(1);
  });

  it('드롭 등급이 자동장착 기준을 넘으면 인벤토리 대신 장착된다', () => {
    const character = { equippedItems: [], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];

    const result = resolveIdleKill({
      character,
      currency,
      inventory,
      autoEquipMinGrade: 'normal',
      randomFn: () => 0,
    });

    expect(result.autoEquipResult.equipped).toBe(true);
    expect(inventory).toHaveLength(0);
    expect(character.equippedItems).toHaveLength(1);
  });
});
