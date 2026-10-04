import { RUNES, RUNEWORDS, AFFIXES } from "../data/expansion.js";
import { GRADE_ORDER, gradeRank } from "../data/dropTable.js";
import { rollItem } from "./items.js";
const fail = (message) => ({ ok: false, message });
const done = (message) => ({ ok: true, message });
export function rebuildItem(item) {
  item.baseBonus ||= { ...item.statBonus };
  const total = { ...item.baseBonus };
  const add = (bonus) => {
    for (const [k, v] of Object.entries(bonus || {}))
      total[k] = (total[k] || 0) + v;
  };
  add(item.affix?.bonus);
  for (const rune of item.sockets || []) add(RUNES[rune]?.bonus);
  const word = RUNEWORDS.find(
    (w) => JSON.stringify(w.runes) === JSON.stringify(item.sockets),
  );
  item.runeword = word?.id || null;
  if (word) add(word.bonus);
  item.statBonus = total;
  return item;
}
export function rollAffix(item, random = Math.random) {
  const definition = AFFIXES[Math.floor(random() * AFFIXES.length)],
    amount = 1 + gradeRank(item.grade) + Math.floor(random() * 3);
  item.affix = {
    name: definition.name,
    bonus: {
      atk: definition.stat === "def" ? 0 : amount,
      def: definition.stat === "atk" ? 0 : amount,
    },
  };
  return rebuildItem(item);
}
export function identifyItem(state, id, random = Math.random) {
  const item = state.inventory.find((i) => i.id === id);
  if (!item || item.identified !== false)
    return fail("감정할 장비를 선택하세요.");
  const cost = 10 * (gradeRank(item.grade) + 1);
  if (state.currency.gold < cost) return fail(`${cost}G가 필요합니다.`);
  state.currency.gold -= cost;
  item.identified = true;
  rollAffix(item, random);
  return done(`${item.name}: ${item.affix.name} 옵션을 발견했습니다.`);
}
export function socketRune(state, id, rune) {
  const item = state.inventory.find((i) => i.id === id);
  if (!item || item.identified === false)
    return fail("감정된 인벤토리 장비를 선택하세요.");
  if (!RUNES[rune] || !(state.materials[rune] > 0))
    return fail("룬이 부족합니다.");
  if ((item.sockets || []).length >= (item.socketCount || 2))
    return fail("소켓이 가득 찼습니다.");
  item.sockets ||= [];
  state.materials[rune]--;
  item.sockets.push(rune);
  rebuildItem(item);
  return done(
    item.runeword
      ? `룬워드 ${RUNEWORDS.find((w) => w.id === item.runeword).name} 완성!`
      : `${RUNES[rune].name} 룬을 새겼습니다.`,
  );
}
export function salvageItem(state, id) {
  const index = state.inventory.findIndex((i) => i.id === id);
  if (index < 0) return fail("분해할 장비가 없습니다.");
  const [item] = state.inventory.splice(index, 1),
    amount = gradeRank(item.grade) + 1;
  state.materials.dust += amount;
  return done(`장비를 분해해 별가루 ${amount}개를 얻었습니다.`);
}
export function cubeUpgrade(state, grade, random = Math.random) {
  const rank = gradeRank(grade),
    cost = (rank + 1) * 30;
  if (rank < 0 || rank >= GRADE_ORDER.length - 1)
    return fail("이 등급은 승급할 수 없습니다.");
  const candidates = state.inventory
    .filter(
      (i) => i.grade === grade && i.identified !== false && !i.sockets?.length,
    )
    .slice(0, 3);
  if (candidates.length < 3)
    return fail("같은 등급의 감정된 빈 소켓 장비 3개가 필요합니다.");
  if (state.currency.gold < cost) return fail(`${cost}G가 필요합니다.`);
  const item = rollItem(random, {
    grade: GRADE_ORDER[rank + 1],
    slot: candidates[0].slot,
    identified: true,
  });
  rollAffix(item, random);
  const ids = new Set(candidates.map((i) => i.id));
  state.inventory = state.inventory.filter((i) => !ids.has(i.id));
  state.inventory.push(item);
  state.currency.gold -= cost;
  return { ...done(`${item.name} 합성 완료`), item };
}
export function rerollItem(state, id, random = Math.random) {
  const item = state.inventory.find((i) => i.id === id);
  if (!item || item.identified === false || item.grade === "normal")
    return fail("고급 이상 감정된 장비를 선택하세요.");
  if (state.materials.dust < 3 || state.currency.gold < 25)
    return fail("별가루 3개와 25G가 필요합니다.");
  state.materials.dust -= 3;
  state.currency.gold -= 25;
  rollAffix(item, random);
  return done(`${item.affix.name} 옵션으로 재추첨했습니다. 소켓은 유지됩니다.`);
}
export function transmuteRune(state, rune) {
  const keys = Object.keys(RUNES),
    index = keys.indexOf(rune);
  if (index < 0 || state.materials[rune] < 3)
    return fail("같은 룬 3개가 필요합니다.");
  state.materials[rune] -= 3;
  const next = keys[(index + 1) % keys.length];
  state.materials[next]++;
  return done(`${RUNES[next].name} 룬 1개로 변환했습니다.`);
}
export function awardMaterials(state, count = 1) {
  for (let n = 0; n < count; n++) {
    state.progression.kills++;
    if (state.progression.kills % 5 === 0) {
      const key =
        Object.keys(RUNES)[Math.floor(state.progression.kills / 5 - 1) % 3];
      state.materials[key]++;
    }
  }
}
