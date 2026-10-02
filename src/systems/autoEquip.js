import { gradeRank } from '../data/dropTable.js';

export function statTotal(item) {
  return Object.values(item.statBonus).reduce((sum, v) => sum + v, 0);
}

export function shouldAutoEquip(droppedItem, currentEquipped, minGrade) {
  if (gradeRank(droppedItem.grade) < gradeRank(minGrade)) return false;
  const current = currentEquipped.find((i) => i.slot === droppedItem.slot);
  if (!current) return true;
  return statTotal(droppedItem) > statTotal(current);
}

// Mutates character.equippedItems in place (by design; Task 9 depends on this).
export function autoEquip(droppedItem, character, minGrade) {
  if (!shouldAutoEquip(droppedItem, character.equippedItems, minGrade)) {
    return { equipped: false, replaced: null };
  }
  const idx = character.equippedItems.findIndex((i) => i.slot === droppedItem.slot);
  const replaced = idx >= 0 ? character.equippedItems[idx] : null;
  if (idx >= 0) {
    character.equippedItems[idx] = droppedItem;
  } else {
    character.equippedItems.push(droppedItem);
  }
  return { equipped: true, replaced };
}
