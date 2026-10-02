import { itemGoldValue } from './inventory.js';

export function restoreCost(item) {
  return itemGoldValue(item);
}

export function restoreFromScrapbook(scrapbook, character, currency, itemId) {
  const idx = scrapbook.findIndex((i) => i.id === itemId);
  if (idx < 0) return { restored: false, reason: 'not_found' };

  const item = scrapbook[idx];
  const cost = restoreCost(item);
  if (currency.gold < cost) return { restored: false, reason: 'insufficient_gold' };

  currency.gold -= cost;
  scrapbook.splice(idx, 1);

  const slotIdx = character.equippedItems.findIndex((i) => i.slot === item.slot);
  const previouslyEquipped = slotIdx >= 0 ? character.equippedItems[slotIdx] : null;
  if (slotIdx >= 0) {
    character.equippedItems[slotIdx] = item;
  } else {
    character.equippedItems.push(item);
  }
  if (previouslyEquipped) {
    scrapbook.push(previouslyEquipped);
  }
  return { restored: true, cost, previouslyEquipped };
}
