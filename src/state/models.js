export function createCharacter() {
  return {
    level: 1,
    exp: 0,
    stats: { atk: 10, def: 5, crit: 0.05 },
    equippedItems: [],
    skillPoints: 0,
    skills: {},
  };
}

export function createItem({ id, name, grade, statBonus, slot }) {
  return { id, name, grade, statBonus, slot };
}

export function createCurrency() {
  return { gold: 0 };
}

export function createRunState() {
  return { mode: 'idle', stageIndex: 0, combatTimer: 0, distancePx: 0 };
}
