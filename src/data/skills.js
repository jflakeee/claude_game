export const SKILL_DEFS = {
  power_strike: {
    id: 'power_strike',
    name: '강타',
    maxLevel: 5,
    effect: (level) => ({ atkMultiplier: 1 + level * 0.1 }),
  },
  iron_skin: {
    id: 'iron_skin',
    name: '철갑',
    maxLevel: 5,
    effect: (level) => ({ defMultiplier: 1 + level * 0.1 }),
  },
};

export function learnOrLevelSkill(character, skillId) {
  const def = SKILL_DEFS[skillId];
  if (!def) throw new Error(`Unknown skill: ${skillId}`);
  const currentLevel = character.skills[skillId] || 0;
  if (currentLevel >= def.maxLevel) return false;
  if (character.skillPoints <= 0) return false;
  character.skills[skillId] = currentLevel + 1;
  character.skillPoints -= 1;
  return true;
}

export function applySkillEffects(character) {
  let atkMultiplier = 1;
  let defMultiplier = 1;
  for (const [skillId, level] of Object.entries(character.skills)) {
    const def = SKILL_DEFS[skillId];
    if (!def) continue;
    const effect = def.effect(level);
    if (effect.atkMultiplier) atkMultiplier *= effect.atkMultiplier;
    if (effect.defMultiplier) defMultiplier *= effect.defMultiplier;
  }
  return {
    atk: Math.round(character.stats.atk * atkMultiplier),
    def: Math.round(character.stats.def * defMultiplier),
  };
}
