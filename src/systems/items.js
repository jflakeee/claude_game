import { rollGrade, gradeRank } from "../data/dropTable.js";
import { autoEquip } from "./autoEquip.js";
import { addItemToInventory } from "./inventory.js";

export const GRADE_LABEL = {
  normal: "일반",
  magic: "고급",
  rare: "희귀",
  epic: "영웅",
};
export function rollItem(random = Math.random) {
  const grade = rollGrade(random);
  return {
    id: `item_${Date.now()}_${Math.floor(random() * 1e9)}`,
    name: `${GRADE_LABEL[grade]} 별빛 지팡이`,
    grade,
    slot: "weapon",
    statBonus: { atk: gradeRank(grade) + 1, def: gradeRank(grade) + 1 },
  };
}
export function receiveItem(state, item) {
  const result = autoEquip(
    item,
    state.character,
    state.settings.autoEquipMinGrade,
  );
  if (result.replaced) state.scrapbook.push(result.replaced);
  const inventory = addItemToInventory(
    state.inventory,
    item,
    state.currency,
    result.equipped,
  );
  return { ...result, ...inventory };
}
export function equipInventoryItem(state, id) {
  const index = state.inventory.findIndex((item) => item.id === id);
  if (index < 0) return false;
  const [item] = state.inventory.splice(index, 1);
  const equipped = state.character.equippedItems;
  const slot = equipped.findIndex((i) => i.slot === item.slot);
  if (slot >= 0) {
    state.scrapbook.push(equipped[slot]);
    equipped[slot] = item;
  } else equipped.push(item);
  return true;
}
