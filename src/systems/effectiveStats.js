import { applySkillEffects } from "../data/skills.js";

export function computeEffectiveStats(character) {
  const gearBonus = character.equippedItems.reduce((acc, item) => {
    for (const [stat, value] of Object.entries(item.statBonus || {})) {
      acc[stat] = (acc[stat] || 0) + value;
    }
    return acc;
  }, {});

  const baseWithGear = {
    atk: (character.stats?.atk ?? 10) + (gearBonus.atk || 0),
    def: (character.stats?.def ?? 5) + (gearBonus.def || 0),
  };

  const setPieces = new Set(
    character.equippedItems
      .filter((i) => i.setId === "starlight" && i.identified !== false)
      .map((i) => i.slot),
  ).size;
  if (setPieces >= 2) {
    baseWithGear.atk += 6;
    baseWithGear.def += 6;
  }
  return applySkillEffects({ stats: baseWithGear, skills: character.skills });
}

export function computeCombatStats(character) {
  const stats = computeEffectiveStats(character),
    skills = character.skills || {};
  const words = character.equippedItems.map((i) => i.runeword);
  const setPieces = new Set(
    character.equippedItems
      .filter((i) => i.setId === "starlight" && i.identified !== false)
      .map((i) => i.slot),
  ).size;
  const starheart = character.equippedItems.some(
    (i) => i.uniqueEffect === "starheart" && i.identified !== false,
  );
  return {
    ...stats,
    setPieces,
    starheart,
    crit: Math.min(1, (character.stats?.crit ?? 0.05) + (starheart ? 0.1 : 0)),
    pierce: skills.piercing || 0,
    synergy: skills.piercing ? (skills.power_strike || 0) * 0.03 : 0,
    lifeSteal:
      (skills.vampirism || 0) * 0.02 + (words.includes("cinder") ? 0.04 : 0),
    slow: words.includes("veil") ? 0.15 : 0,
    regen: (words.includes("dawn") ? 1 : 0) + (setPieces >= 3 ? 1.5 : 0),
    aura: skills[character.activeAura] > 0 ? character.activeAura : null,
    curse: skills[character.activeCurse] > 0 ? character.activeCurse : null,
    auraLevel: skills[character.activeAura] || 0,
    curseLevel: skills[character.activeCurse] || 0,
    attackSynergy: (skills.power_strike || 0) * 0.02,
    defenseSynergy: (skills.iron_skin || 0) * 0.1,
  };
}
