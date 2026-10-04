import { rollItem } from "./items.js";
import { autoEquip } from "./autoEquip.js";
import { addItemToInventory } from "./inventory.js";

export const STAGE_LENGTH_PX = 2000;
export const IDLE_MOVE_SPEED_PX_PER_S = 50;
export const IDLE_COMBAT_TICK_MS = 1000;

export function createIdleProgress() {
  return { stageIndex: 0, distancePx: 0 };
}

export function advanceIdleProgress(progress, deltaMs) {
  progress.distancePx += IDLE_MOVE_SPEED_PX_PER_S * (deltaMs / 1000);
  if (progress.distancePx >= STAGE_LENGTH_PX) {
    progress.distancePx = 0;
    progress.stageIndex += 1;
    return true;
  }
  return false;
}

export function resolveIdleKill({
  character,
  currency,
  inventory,
  scrapbook,
  autoEquipMinGrade,
  randomFn = Math.random,
}) {
  const goldDrop = 2;
  const expDrop = 3;
  currency.gold += goldDrop;
  character.exp += expDrop;

  const item = rollItem(randomFn);

  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  let inventoryResult = {};
  if (!autoEquipResult.equipped) {
    inventoryResult = addItemToInventory(inventory, item, currency, false);
  } else if (autoEquipResult.replaced) {
    scrapbook.push(autoEquipResult.replaced);
  }
  return { goldDrop, expDrop, item, autoEquipResult, ...inventoryResult };
}
