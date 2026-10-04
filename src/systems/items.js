import { rollGrade, gradeRank } from "../data/dropTable.js";
import { autoEquip } from "./autoEquip.js";
import { addItemToInventory, INVENTORY_CAPACITY } from "./inventory.js";

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
  const delivery = { ...result, ...inventory };
  recordLoot(state, item, delivery);
  return delivery;
}
export function recordLoot(state, item, delivery = {}) {
  if (gradeRank(item.grade) < 2) return;
  state.lootNotice = {
    id: item.id,
    message: `${GRADE_LABEL[item.grade]} 장비 획득! ${delivery.convertedToGold ? `${delivery.convertedToGold}G 환산` : delivery.equipped ? "자동 장착" : item.identified === false ? "가방에서 감정하세요." : "인벤토리 보관"}`,
  };
}
export function unequipItem(state, id) {
  const index = state.character.equippedItems.findIndex((i) => i.id === id);
  if (index < 0)
    return { ok: false, message: "장착한 장비를 찾을 수 없습니다." };
  if (state.inventory.length >= INVENTORY_CAPACITY)
    return {
      ok: false,
      message: "가방이 가득 찼습니다. 장비는 장착 상태로 유지됩니다.",
    };
  state.inventory.push(...state.character.equippedItems.splice(index, 1));
  return {
    ok: true,
    message: "장비를 가방으로 옮겼습니다. 제작실에서 강화할 수 있습니다.",
  };
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
