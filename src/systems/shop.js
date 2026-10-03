import { rollItem } from "./items.js";
import { autoEquip } from "./autoEquip.js";
import { addItemToInventory } from "./inventory.js";

export const GACHA_COST = 20;

export function pullGacha({
  character,
  currency,
  inventory,
  scrapbook,
  autoEquipMinGrade,
  randomFn = Math.random,
}) {
  if (currency.gold < GACHA_COST) return { success: false, item: null };
  currency.gold -= GACHA_COST;

  const item = rollItem(randomFn);

  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  let convertedToGold = 0;
  if (!autoEquipResult.equipped) {
    convertedToGold = addItemToInventory(
      inventory,
      item,
      currency,
      false,
    ).convertedToGold;
  } else if (autoEquipResult.replaced) {
    scrapbook.push(autoEquipResult.replaced);
  }

  return { success: true, item, autoEquipResult, convertedToGold };
}
