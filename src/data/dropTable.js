export const GRADE_ORDER = ['normal', 'magic', 'rare', 'epic'];

export const GRADE_WEIGHTS = {
  normal: 60,
  magic: 25,
  rare: 12,
  epic: 3,
};

export function rollGrade(randomFn = Math.random) {
  const total = Object.values(GRADE_WEIGHTS).reduce((sum, w) => sum + w, 0);
  const roll = randomFn() * total;
  let cumulative = 0;
  for (const grade of GRADE_ORDER) {
    cumulative += GRADE_WEIGHTS[grade];
    if (roll < cumulative) return grade;
  }
  return GRADE_ORDER[GRADE_ORDER.length - 1];
}

export function gradeRank(grade) {
  return GRADE_ORDER.indexOf(grade);
}
