import { applySkillEffects } from '../data/skills.js';

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

  return applySkillEffects({ stats: baseWithGear, skills: character.skills });
}
