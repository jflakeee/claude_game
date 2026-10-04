import { GRADE_ORDER } from "../data/dropTable.js";
import { RUNES, RUNEWORDS } from "../data/expansion.js";
import { GRADE_LABEL } from "../systems/items.js";
import { SKILL_DEFS, skillLockReason } from "../data/skills.js";
import { computeCombatStats } from "../systems/effectiveStats.js";
import {
  identifyItem,
  socketRune,
  salvageItem,
  cubeUpgrade,
  rerollItem,
  transmuteRune,
} from "../systems/crafting.js";
import {
  buyStock,
  buyRune,
  sellItem,
  buyBack,
  bidAuction,
  listAuction,
  cancelAuction,
  claimDelivery,
} from "../systems/market.js";
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const esc = escapeHtml;
const button = (action, label, id = "", disabled = false) =>
  `<button data-action="${action}" data-item-id="${esc(id)}" ${disabled ? "disabled" : ""}>${label}</button>`;
export function sectionNav(tab, active) {
  const choices =
    tab === "equipment"
      ? { gear: "장비", craft: "제작실" }
      : { gacha: "별빛 상자", merchant: "NPC 상인", auction: "NPC 경매" };
  return `<div class="subnav" aria-label="${tab === "equipment" ? "장비 메뉴" : "상점 메뉴"}">${Object.entries(
    choices,
  )
    .map(
      ([key, label]) =>
        `<button data-view="${key}" aria-pressed="${active === key}">${label}</button>`,
    )
    .join("")}</div>`;
}
const itemOptions = (items) =>
  items
    .map(
      (i) =>
        `<option value="${esc(i.id)}">${i.identified === false ? "[미감정] " : ""}${esc(i.name)} · ${i.identified === false ? "옵션 비공개" : `${i.statBonus.atk}공/${i.statBonus.def}방`} ${i.runeword ? "· 룬워드" : ""}</option>`,
    )
    .join("");
const runeOptions = () =>
  Object.entries(RUNES)
    .map(([id, r]) => `<option value="${id}">${r.glyph} ${r.name}</option>`)
    .join("");
export function renderCraft(state) {
  return `<div class="craft-banner"><span class="eyebrow">THE ASTRAL FORGE</span><h2>별빛 제작실</h2><p>룬의 순서가 장비의 운명을 바꿉니다.</p></div><div class="material-strip">${Object.entries(
    RUNES,
  )
    .map(
      ([id, r]) =>
        `<span>${r.glyph} ${r.name} <b>${state.materials[id]}</b></span>`,
    )
    .join(
      "",
    )}<span>✧ 별가루 <b>${state.materials.dust}</b></span></div><p class="hint">처치 5회마다 룬 획득 · 최초 화염/서리/수호 1개 지급</p><label class="field-label">대상 장비<select data-field="craft-item" aria-label="제작할 장비"><option value="">장비 선택</option>${itemOptions(state.inventory)}</select></label><div class="craft-actions">${button("identify", "감정 · 등급별 10~60G")}${button("salvage", "분해 · 장비 소멸")}${button("reroll", "옵션 재추첨 · 가루 3 + 25G")}</div><div class="forge-card"><h3>룬 새기기</h3><p>감정된 가방 장비 · 2소켓 · 삽입 후 되돌릴 수 없습니다.</p><select data-field="rune" aria-label="새길 룬">${runeOptions()}</select>${button("socket", "선택 룬 1개 삽입")}<div class="recipe-grid">${RUNEWORDS.map((w) => `<div><b>${w.name}</b><span>${w.runes.map((r) => RUNES[r].name).join(" → ")}</span><small>${w.description}</small></div>`).join("")}</div></div><div class="forge-card"><h3>호라 큐브 · 장비 승급</h3><p>같은 등급의 감정된 빈 소켓 장비 3개를 소비합니다.<br>목록 앞의 3개 → 첫 재료와 같은 슬롯의 다음 등급 1개</p><select data-field="cube-grade" aria-label="합성 등급">${GRADE_ORDER.slice(
    0,
    -1,
  )
    .map(
      (g, i) =>
        `<option value="${g}">${GRADE_LABEL[g]} 3개 + ${(i + 1) * 30}G → ${GRADE_LABEL[GRADE_ORDER[i + 1]]}</option>`,
    )
    .join(
      "",
    )}</select>${button("cube", "3개 합성")}</div><div class="forge-card"><h3>룬 변환</h3><p>화염 3 → 서리 1 / 서리 3 → 수호 1 / 수호 3 → 화염 1</p><select data-field="transmute-rune" aria-label="변환할 룬">${runeOptions()}</select>${button("transmute", "선택 룬 3개 변환")}</div>`;
}
function itemSummary(item) {
  return `<b class="${esc(item.grade)}">${item.identified === false ? "미감정 " : ""}${esc(item.name)}</b><small>${item.identified === false ? "감정 전 옵션 비공개" : `공격 ${item.statBonus.atk} · 방어 ${item.statBonus.def}`} · ${{ weapon: "무기", armor: "갑옷", charm: "부적" }[item.slot] || "장비"}</small>`;
}
export function renderMarket(state, view) {
  const market = state.market;
  if (view === "merchant")
    return `<div class="section-title">떠돌이 상인 <span>5분마다 재입고</span></div><p class="hint">NPC와 골드로 거래합니다. 매각 장비는 최근 10개까지 되사기 가능합니다.</p>${market.stock.map((o) => `<div class="market-row"><div>${itemSummary(o.item)}</div>${button("buy-stock", `${o.price}G 구매`, o.id, state.currency.gold < o.price)}</div>`).join("")}<div class="section-title">룬 상점 <span>각 30G</span></div><div class="craft-actions">${Object.entries(
      RUNES,
    )
      .map(([id, r]) =>
        button(
          "buy-rune",
          `${r.glyph} ${r.name}`,
          id,
          state.currency.gold < 30,
        ),
      )
      .join(
        "",
      )}</div><div class="section-title">인벤토리 판매</div><select data-field="sell-item" aria-label="매각할 장비"><option value="">장비 선택</option>${itemOptions(state.inventory)}</select>${button("sell", "선택 장비 판매")}<div class="section-title">되사기</div>${market.buyback.map((o) => `<div class="market-row"><div>${itemSummary(o.item)}</div>${button("buyback", `${o.price}G 되사기`, o.id)}</div>`).join("") || '<p class="empty-state">최근 매각한 장비가 없습니다.</p>'}`;
  return `<div class="section-title">1인용 NPC 경매 <span>AUCTION HOUSE</span></div><p class="hint">실제 사용자 간 거래가 아닙니다. NPC가 경쟁 입찰합니다.<br>입찰금은 예치되며 패찰 시 전액 환불됩니다.</p>${market.auctions.map((a) => `<div class="auction-card"><div class="section-title">${a.seller === "player" ? "내 출품" : "NPC 출품"} <span data-auction-end="${a.endAt}"></span></div>${itemSummary(a.item)}<p>${a.bid}G · ${a.highest === "player" ? "내가 최고 입찰자" : a.highest === "npc" ? "NPC 입찰 중" : "입찰 없음"}</p><div class="craft-actions">${a.seller === "player" ? button("cancel-auction", "출품 취소", a.id, !!a.highest) : button("bid", `${a.bid + 5}G 입찰`, a.id, state.currency.gold + a.escrow < a.bid + 5) + button("buyout", `${a.buyout}G 즉시 구매`, a.id, state.currency.gold + a.escrow < a.buyout)}</div></div>`).join("")}<div class="section-title">내 장비 출품 <span>출품 5G · 수수료 5%</span></div><select data-field="auction-item" aria-label="출품할 장비"><option value="">감정된 장비 선택</option>${itemOptions(state.inventory.filter((i) => i.identified !== false))}</select><select data-field="auction-price" aria-label="출품 시작가"><option value="1">상인 매입가 1배 · 빠른 판매</option><option value="2">상인 매입가 2배 · 균형</option><option value="3">상인 매입가 3배 · 유찰 가능</option></select>${button("list-auction", "90초 경매 출품")}<div class="section-title">낙찰·반환 보관함 <span>${market.deliveries.length}개</span></div>${market.deliveries.map((d) => `<div class="market-row"><div>${itemSummary(d.item)}<small>${esc(d.message)}</small></div>${button("claim", "수령", d.id)}</div>`).join("") || '<p class="empty-state">수령할 장비가 없습니다.</p>'}<div class="section-title">거래 기록</div>${market.history.map((text) => `<p class="hint">${esc(text)}</p>`).join("")}`;
}
export function renderSkillTree(state) {
  const c = state.character,
    stats = computeCombatStats(c);
  return `<div class="section-title">레벨 ${c.level} <span>스킬 포인트 ${c.skillPoints}</span></div><div class="stats-grid"><div><small>공격력</small><strong>${stats.atk}</strong></div><div><small>방어력</small><strong>${stats.def}</strong></div><div><small>치명타</small><strong>${Math.round(stats.crit * 100)}%</strong></div></div><p class="hint">장비·패시브 반영 · 투사체 관통 ${stats.pierce} · 흡혈 ${Math.round(stats.lifeSteal * 100)}%<br>오라와 저주는 각각 하나씩 선택하여 자동 적용합니다.<br>별빛 세트 ${stats.setPieces}/3 · 2부위: 공격/방어 +6 · 3부위: 초당 회복 +1.5${stats.starheart ? "<br>별의 심장 활성 · 치명타 +10%" : ""}</p>${Object.values(
    SKILL_DEFS,
  )
    .map((def) => {
      const level = c.skills[def.id] || 0,
        reason = skillLockReason(c, def.id),
        selected =
          c[def.kind === "aura" ? "activeAura" : "activeCurse"] === def.id;
      return `<div class="tree-card"><div class="section-title">${def.name} <span>Lv.${level}/${def.maxLevel}</span></div><p>${def.description || (def.id === "power_strike" ? "단계당 공격력 +10%" : "단계당 방어력 +10%")}</p><small>${
        Object.entries(def.requires || {})
          .map(([id, n]) => `${SKILL_DEFS[id].name} ${n}`)
          .join(" + ") || "기초 패시브"
      }${def.requiredLevel ? ` · 캐릭터 레벨 ${def.requiredLevel}` : ""}</small><div class="craft-actions"><button data-action="learn-skill" data-skill-id="${def.id}" ${reason ? "disabled" : ""}>${reason || "투자 · 1포인트"}</button>${def.kind ? `<button data-action="select-skill" data-item-id="${def.id}" ${!level ? "disabled" : ""} aria-pressed="${selected}">${selected ? "사용 중 · 해제" : "선택"}</button>` : ""}</div></div>`;
    })
    .join("")}`;
}
export function expansionAction(state, action, id, fields) {
  const item = fields["craft-item"];
  switch (action) {
    case "identify":
      return identifyItem(state, id || item);
    case "socket":
      return socketRune(state, item, fields.rune);
    case "salvage":
      return salvageItem(state, item);
    case "cube":
      return cubeUpgrade(state, fields["cube-grade"]);
    case "reroll":
      return rerollItem(state, item);
    case "transmute":
      return transmuteRune(state, fields["transmute-rune"]);
    case "buy-stock":
      return buyStock(state, id);
    case "buy-rune":
      return buyRune(state, id);
    case "sell":
      return sellItem(state, fields["sell-item"]);
    case "buyback":
      return buyBack(state, id);
    case "bid":
      return bidAuction(state, id);
    case "buyout":
      return bidAuction(state, id, true);
    case "list-auction":
      return listAuction(
        state,
        fields["auction-item"],
        Number(fields["auction-price"]),
      );
    case "cancel-auction":
      return cancelAuction(state, id);
    case "claim":
      return claimDelivery(state, id);
    case "select-skill": {
      const def = SKILL_DEFS[id];
      if (!def?.kind || !(state.character.skills[id] > 0))
        return { ok: false, message: "먼저 스킬을 배워주세요." };
      const key = def.kind === "aura" ? "activeAura" : "activeCurse";
      state.character[key] = state.character[key] === id ? null : id;
      return {
        ok: true,
        message: state.character[key] ? `${def.name} 활성화` : "효과 선택 해제",
      };
    }
    default:
      return null;
  }
}
