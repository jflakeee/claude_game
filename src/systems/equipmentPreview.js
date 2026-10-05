import { computeCombatStats } from './effectiveStats.js';

// A preview must never mutate equipment, award a bonus or consume an item.
export function equipmentPreview(character, candidate) {
  if (!candidate || candidate.identified === false) return null;
  const current = character.equippedItems.find(item => item.slot === candidate.slot);
  const before = computeCombatStats(character);
  const equipment = character.equippedItems.filter(item => item.slot !== candidate.slot);
  const after = computeCombatStats({ ...character, equippedItems: [...equipment, candidate] });
  const lost = [];
  if (before.setPieces >= 2 && after.setPieces < 2) lost.push('별빛 2세트 · 공격/방어 +6 해제');
  if (before.setPieces >= 3 && after.setPieces < 3) lost.push('별빛 3세트 · 재생 효과 해제');
  if (before.starheart && !after.starheart) lost.push('별의 심장 효과 해제');
  if (current?.runeword && !equipment.some(item => item.runeword === current.runeword) && candidate.runeword !== current.runeword)
    lost.push('현재 룬워드 효과 해제');
  return { before, after, lost, current };
}
