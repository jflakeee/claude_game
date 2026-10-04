export const GRADE_ORDER = ["normal", "magic", "rare", "epic", "set", "unique"];

export const GRADE_WEIGHTS = {
  normal: 58,
  magic: 25,
  rare: 12,
  epic: 3,
  set: 1.5,
  unique: 0.5,
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
