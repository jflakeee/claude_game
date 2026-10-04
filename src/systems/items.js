import { rollGrade, gradeRank } from "../data/dropTable.js";
import { autoEquip } from "./autoEquip.js";
import { addItemToInventory } from "./inventory.js";

export const GRADE_LABEL = {
  normal: "일반",
  magic: "고급",
  rare: "희귀",
  epic: "영웅",
  set: "세트",
  unique: "고유",
};
export function rollItem(random = Math.random, options = {}) {
  const grade = options.grade || rollGrade(random);
  const slot =
    options.slot || ["weapon", "armor", "charm"][Math.floor(random() * 3)];
  const rank = gradeRank(grade) + 1;
  return {
    id: `item_${Date.now()}_${Math.floor(random() * 1e9)}`,
    name: `${GRADE_LABEL[grade]} ${{ weapon: "별빛 지팡이", armor: "회랑 갑옷", charm: "달빛 부적" }[slot]}`,
    grade,
    ...(grade === "set" ? { setId: "starlight" } : {}),
    ...(grade === "unique" ? { uniqueEffect: "starheart" } : {}),
    slot,
    identified: options.identified ?? rank < 3,
    sockets: [],
    socketCount: 2,
    statBonus: {
      atk: slot === "armor" ? rank : rank * 2,
      def: slot === "weapon" ? rank : rank * 2,
    },
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
  if (state.inventory[index].identified === false) return false;
  const [item] = state.inventory.splice(index, 1);
  const equipped = state.character.equippedItems;
  const slot = equipped.findIndex((i) => i.slot === item.slot);
  if (slot >= 0) {
    state.scrapbook.push(equipped[slot]);
    equipped[slot] = item;
  } else equipped.push(item);
  return true;
}
