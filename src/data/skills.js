export const SKILL_DEFS = {
  power_strike: {
    id: "power_strike",
    name: "강타",
    maxLevel: 5,
    effect: (level) => ({ atkMultiplier: 1 + level * 0.1 }),
  },
  iron_skin: {
    id: "iron_skin",
    name: "철갑",
    maxLevel: 5,
    effect: (level) => ({ defMultiplier: 1 + level * 0.1 }),
  },
  piercing: {
    id: "piercing",
    name: "관통",
    maxLevel: 3,
    requiredLevel: 3,
    requires: { power_strike: 2 },
    description: "투사체가 추가 적 관통 · 강타 단계당 피해 3% 시너지",
    effect: () => ({}),
  },
  vampirism: {
    id: "vampirism",
    name: "흡혈",
    maxLevel: 3,
    requiredLevel: 4,
    requires: { power_strike: 2 },
    description: "단계당 피해의 2% 회복",
    effect: () => ({}),
  },
  frailty: {
    id: "frailty",
    name: "분쇄 저주",
    maxLevel: 3,
    requiredLevel: 3,
    requires: { power_strike: 1 },
    kind: "curse",
    description: "명중한 적 4초간 추가 피해 · 단계당 8%",
    effect: () => ({}),
  },
  chill: {
    id: "chill",
    name: "한기 저주",
    maxLevel: 3,
    requiredLevel: 3,
    requires: { iron_skin: 1 },
    kind: "curse",
    description: "명중한 적 4초간 둔화 · 단계당 12%",
    effect: () => ({}),
  },
  fury: {
    id: "fury",
    name: "분노 오라",
    maxLevel: 3,
    requiredLevel: 5,
    requires: { power_strike: 3, piercing: 1 },
    kind: "aura",
    description: "범위 130 내 적에게 공격 +10%/단계 · 강타와 시너지",
    effect: () => ({}),
  },
  renewal: {
    id: "renewal",
    name: "회복 오라",
    maxLevel: 3,
    requiredLevel: 5,
    requires: { iron_skin: 3, chill: 1 },
    kind: "aura",
    description: "초당 체력 +0.6/단계 · 철갑 단계당 0.1 시너지",
    effect: () => ({}),
  },
};

export function skillLockReason(character, skillId) {
  const def = SKILL_DEFS[skillId];
  if (!def) return "알 수 없는 스킬";
  if ((character.skills[skillId] || 0) >= def.maxLevel) return "최대 단계";
  if ((character.level || 1) < (def.requiredLevel || 1))
    return `레벨 ${def.requiredLevel} 필요`;
  for (const [id, level] of Object.entries(def.requires || {}))
    if ((character.skills[id] || 0) < level)
      return `${SKILL_DEFS[id].name} ${level}단계 필요`;
  if (character.skillPoints <= 0) return "스킬 포인트 부족";
  return "";
}

export function learnOrLevelSkill(character, skillId) {
  const def = SKILL_DEFS[skillId];
  if (!def) throw new Error(`Unknown skill: ${skillId}`);
  if (skillLockReason(character, skillId)) return false;
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
