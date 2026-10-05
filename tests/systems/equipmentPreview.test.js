import { describe, it, expect } from 'vitest';
import { equipmentPreview } from '../../src/systems/equipmentPreview.js';
import { autoEquip } from '../../src/systems/autoEquip.js';
import { rollItem } from '../../src/systems/items.js';
import { createCharacter } from '../../src/state/models.js';

const item = (grade, slot) => rollItem(() => 0.5, { grade, slot, identified: true });
describe('equipment decisions', () => {
  it('shows set loss and crit gain without mutating the loadout', () => {
    const character = createCharacter();
    character.equippedItems = [item('set', 'weapon'), item('set', 'armor')];
    const snapshot = JSON.stringify(character);
    const preview = equipmentPreview(character, item('unique', 'weapon'));
    expect(preview.before.atk).toBe(31);
    expect(preview.after.atk).toBe(27);
    expect(preview.after.def).toBe(21);
    expect(preview.after.crit).toBeCloseTo(0.15);
    expect(preview.lost).toContain('별빛 2세트 · 공격/방어 +6 해제');
    expect(JSON.stringify(character)).toBe(snapshot);
  });
  it('preserves a locked slot during automatic replacement', () => {
    const current = { ...item('normal', 'weapon'), autoEquipLocked: true };
    const character = { equippedItems: [current] };
    expect(autoEquip(item('unique', 'weapon'), character, 'normal').equipped).toBe(false);
    expect(character.equippedItems[0]).toBe(current);
    current.autoEquipLocked = false;
    expect(autoEquip(item('unique', 'weapon'), character, 'normal').equipped).toBe(true);
  });
  it('does not expose unidentified stats or claim a retained runeword was lost', () => {
    const character = createCharacter();
    character.equippedItems = [
      { ...item('rare', 'weapon'), runeword: 'dawn' },
      { ...item('rare', 'armor'), runeword: 'dawn' },
    ];
    expect(equipmentPreview(character, { identified: false })).toBeNull();
    expect(equipmentPreview(character, item('unique', 'weapon')).lost).not.toContain('현재 룬워드 효과 해제');
  });
});
