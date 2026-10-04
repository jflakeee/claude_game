export const RUNES = {
  ember: { name: "화염", glyph: "ᚲ", bonus: { atk: 2, def: 0 } },
  frost: { name: "서리", glyph: "ᛁ", bonus: { atk: 1, def: 1 } },
  ward: { name: "수호", glyph: "ᛉ", bonus: { atk: 0, def: 2 } },
};
export const RUNEWORDS = [
  {
    id: "cinder",
    name: "잿불",
    runes: ["ember", "ember"],
    bonus: { atk: 5, def: 0 },
    description: "공격 +5 · 명중 시 피해의 4% 회복",
  },
  {
    id: "veil",
    name: "서리장막",
    runes: ["frost", "ward"],
    bonus: { atk: 0, def: 6 },
    description: "방어 +6 · 명중한 적 15% 둔화",
  },
  {
    id: "dawn",
    name: "여명",
    runes: ["ward", "ember"],
    bonus: { atk: 3, def: 3 },
    description: "공격/방어 +3 · 초당 체력 1 회복",
  },
];
export const AFFIXES = [
  { name: "맹공", stat: "atk" },
  { name: "수호", stat: "def" },
  { name: "균형", stat: "both" },
];
export const BOSS_NAMES = ["회랑의 수문장", "잿불의 감시자", "공허의 군주"];
