import { rollGrade, gradeRank } from '../data/dropTable.js';
import { autoEquip } from './autoEquip.js';
import { addItemToInventory } from './inventory.js';

export const GACHA_COST = 20;

export function pullGacha({ character, currency, inventory, scrapbook, autoEquipMinGrade, randomFn = Math.random }) {
  if (currency.gold < GACHA_COST) return { success: false, item: null };
  currency.gold -= GACHA_COST;

  const grade = rollGrade(randomFn);
  const item = {
    id: `gacha_${Date.now()}_${Math.floor(randomFn() * 100000)}`,
    name: `${grade} 장비`,
    grade,
    statBonus: { atk: gradeRank(grade) + 1 },
    slot: 'weapon',
  };

  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  if (!autoEquipResult.equipped) {
    addItemToInventory(inventory, item, currency, false);
  } else if (autoEquipResult.replaced) {
    scrapbook.push(autoEquipResult.replaced);
  }

  return { success: true, item, autoEquipResult };
}
