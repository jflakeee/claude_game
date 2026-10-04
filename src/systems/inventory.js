export const INVENTORY_CAPACITY = 30;

const GRADE_VALUE = {
  normal: 5,
  magic: 15,
  rare: 40,
  epic: 100,
  set: 180,
  unique: 300,
};

export function itemGoldValue(item) {
  return GRADE_VALUE[item.grade] || 1;
}

export function addItemToInventory(inventory, item, currency, autoEquipped) {
  if (autoEquipped) return { added: false, convertedToGold: 0 };
  if (inventory.length >= INVENTORY_CAPACITY) {
    const goldValue = itemGoldValue(item);
    currency.gold += goldValue;
    return { added: false, convertedToGold: goldValue };
  }
  inventory.push(item);
  return { added: true, convertedToGold: 0 };
}
