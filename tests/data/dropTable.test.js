import { describe, it, expect } from 'vitest';
import { rollGrade, gradeRank, GRADE_ORDER, GRADE_WEIGHTS } from '../../src/data/dropTable.js';

describe('gradeRank', () => {
  it('등급 순서대로 순위를 매긴다', () => {
    expect(gradeRank('normal')).toBe(0);
    expect(gradeRank('magic')).toBe(1);
    expect(gradeRank('rare')).toBe(2);
    expect(gradeRank('epic')).toBe(3);
  });
});

describe('rollGrade', () => {
  it('randomFn이 0을 반환하면 가장 낮은 등급(normal)이 나온다', () => {
    expect(rollGrade(() => 0)).toBe('normal');
  });

  it('randomFn이 거의 1을 반환하면 가장 높은 등급(epic)이 나온다', () => {
    expect(rollGrade(() => 0.9999)).toBe('epic');
  });

  it('가중치 합이 100이 되는 경계값에서 정확히 다음 등급으로 넘어간다', () => {
    const total = Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0);
    const normalBoundary = GRADE_WEIGHTS.normal / total;
    expect(rollGrade(() => normalBoundary - 0.0001)).toBe('normal');
    expect(rollGrade(() => normalBoundary + 0.0001)).toBe('magic');
  });

  it('GRADE_ORDER에 정의된 값만 반환한다 (1000회 샘플)', () => {
    for (let i = 0; i < 1000; i++) {
      expect(GRADE_ORDER).toContain(rollGrade(Math.random));
    }
  });
});
