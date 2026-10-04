import { store } from "../state/globalStore.js";
import { GRADE_WEIGHTS, GRADE_ORDER } from "../data/dropTable.js";
import { itemGoldValue, INVENTORY_CAPACITY } from "../systems/inventory.js";
import { restoreFromScrapbook } from "../systems/scrapbook.js";
import { GACHA_COST, pullGacha } from "../systems/shop.js";
import { learnOrLevelSkill } from "../data/skills.js";
import {
  GRADE_LABEL,
  equipInventoryItem,
  unequipItem,
} from "../systems/items.js";
import { saveState } from "../state/persistence.js";
import { sound } from "../audio.js";
import {
  sectionNav,
  renderCraft,
  renderMarket,
  renderSkillTree,
  expansionAction,
  cubePreview,
} from "./ExpansionPanel.js";
import { RUNES, RUNEWORDS } from "../data/expansion.js";

const TABS = {
  equipment: "장비",
  skills: "스킬",
  settings: "설정",
  shop: "상점",
};
const ICONS = { equipment: "⚔", skills: "✦", settings: "☷", shop: "◇" };
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const gradeLabel = (grade) => GRADE_LABEL[grade] || "일반";
function gradeControl(state) {
  return `<div class="setting-row"><div><b>자동 장착 최소 등급</b><small>${gradeLabel(state.settings.autoEquipMinGrade)} 이상 · 더 좋은 장비로 교체</small></div><button data-action="cycle-auto-equip-grade" aria-label="자동 장착 등급 변경" class="grade ${esc(state.settings.autoEquipMinGrade)}">${gradeLabel(state.settings.autoEquipMinGrade)} ↻</button></div>`;
}
function itemRow(
  item,
  action,
  label,
  status = "장착 중",
  canIdentify = action === "equip-item",
) {
  if (item.identified === false)
    return `<li class="item-row"><span class="item-icon epic">?</span><div class="item-info"><b>미감정 ${esc(item.name)}</b><small>옵션 비공개 · 장착 전 감정 필요</small></div>${canIdentify ? `<button data-action="identify" data-item-id="${esc(item.id)}">감정 ${(GRADE_ORDER.indexOf(item.grade) + 1) * 10}G</button>` : `<span class="equipped-label">${esc(status)}</span>`}</li>`;
  return `<li class="item-row"><span class="item-icon grade ${esc(item.grade)}">⚔</span><div class="item-info"><b>${esc(item.name)} (${esc(item.grade)})</b><small><span class="grade ${esc(item.grade)}">${gradeLabel(item.grade)}</span> · ${esc({ weapon: "무기", armor: "갑옷", charm: "부적" }[item.slot] || "")} · 공격 +${Number(item.statBonus?.atk) || 0} · 방어 +${Number(item.statBonus?.def) || 0}</small><small>${item.setId ? "별빛 세트 · " : item.uniqueEffect ? "별의 심장: 치명타 +10% · " : ""}${item.affix ? esc(item.affix.name) + " · " : ""}${(item.sockets || []).map((r) => RUNES[r]?.glyph || "?").join(" ")}${item.runeword ? " · " + esc(RUNEWORDS.find((w) => w.id === item.runeword)?.name) : ""}</small></div>${action ? `<button data-action="${action}" data-item-id="${esc(item.id)}">${label}</button>` : `<span class="equipped-label">${esc(status)}</span>`}</li>`;
}

export function renderTab(tab, state) {
  if (tab === "equipment" && state.view === "craft")
    return sectionNav(tab, "craft") + renderCraft(state);
  if (tab === "shop" && ["merchant", "auction"].includes(state.view))
    return sectionNav(tab, state.view) + renderMarket(state, state.view);
  if (tab === "equipment")
    return `${sectionNav("equipment", "gear")}${gradeControl(state)}<div class="section-title">장착 장비 <span>WEAPON</span></div><ul class="item-list">${state.character.equippedItems.length ? state.character.equippedItems.map((i) => itemRow(i, "unequip-item", "가방으로")).join("") : '<li class="empty-state">장착한 장비 없음 · 탐험하며 장비를 찾아보세요.</li>'}</ul><div class="section-title">인벤토리 <span>${(state.inventory || []).length}/${INVENTORY_CAPACITY}</span></div><ul class="item-list">${(state.inventory || []).map((i) => itemRow(i, "equip-item", "장착")).join("") || '<li class="empty-state">새로운 장비가 이곳에 모입니다.</li>'}</ul><p class="hint">가방이 가득 차면 새 장비는 자동으로 골드가 됩니다.</p><div class="section-title">스크랩북 <span>${(state.scrapbook || []).length}개</span></div><ul class="item-list">${(state.scrapbook || []).map((i) => itemRow(i, "restore-scrapbook-item", `${itemGoldValue(i)}G 복원`)).join("") || '<li class="empty-state">스크랩북이 비어 있습니다.</li>'}</ul>`;
  if (tab === "skills") return renderSkillTree(state);
  if (tab === "settings")
    return `<div class="section-title">탐험 설정 <span>PREFERENCES</span></div>${gradeControl(state)}${[
      ["sound", "사운드", "공격·획득·버튼 효과음"],
      ["notifications", "알림", "희귀 장비 획득 시 게임 안에서 알림"],
      ["autoProgress", "자동 진행", "방치 탐험과 재화 수집"],
    ]
      .map(
        ([key, name, description]) =>
          `<div class="setting-row"><div><b>${name}</b><small>${description}</small></div><button role="switch" aria-label="${name}" aria-checked="${state.settings[key] !== false}" data-action="toggle-setting" data-setting="${key}" class="toggle ${state.settings[key] !== false ? "on" : ""}">${state.settings[key] !== false ? "켜짐" : "꺼짐"}</button></div>`,
      )
      .join(
        "",
      )}<p class="hint">진행도는 이 브라우저에 자동 저장됩니다.<br>전투 도중 나가거나 새로고침해도 획득한 보상은 유지됩니다.</p>`;
  if (tab === "shop")
    return `${sectionNav("shop", "gacha")}<div class="shop-card"><span class="shop-orb">✧</span><span class="eyebrow">STARLIGHT CHEST</span><h2>별빛 장비 상자</h2><p>작은 행운이 다음 탐험을 바꿉니다.</p><div class="odds">${GRADE_ORDER.map((g) => `<span class="${g}">${GRADE_LABEL[g]} ${GRADE_WEIGHTS[g]}%</span>`).join("")}</div><button class="primary" data-action="pull-gacha" ${state.currency.gold < GACHA_COST ? "disabled" : ""}>뽑기 (${GACHA_COST}골드)</button><small>골드: ${state.currency.gold} · 자동 장착 기준 적용</small></div>${
      state.lastPurchase
        ? `<div class="section-title">방금 획득한 장비 <span>${esc(state.lastPurchase.destination)}</span></div><ul class="item-list">${itemRow(
            (state.inventory || []).find(
              (i) => i.id === state.lastPurchase.item.id,
            ) || state.lastPurchase.item,
            null,
            null,
            state.lastPurchase.destination,
            (state.inventory || []).some(
              (i) => i.id === state.lastPurchase.item.id,
            ),
          )}</ul>`
        : ""
    }`;
  return "";
}

export function mountBottomPanel(container) {
  container.innerHTML = `<button class="panel-handle" aria-label="관리 패널 접기" aria-expanded="true"><span></span></button><div class="tab-bar" role="tablist">${Object.entries(
    TABS,
  )
    .map(
      ([id, label]) =>
        `<button role="tab" aria-selected="${id === "equipment"}" data-tab="${id}" class="tab-button"><span>${ICONS[id]}</span>${label}</button>`,
    )
    .join("")}</div><div class="tab-content" role="tabpanel"></div>`;
  const content = container.querySelector(".tab-content");
  const views = { equipment: "gear", shop: "gacha" };
  function updateCraftPreview() {
    const field = content.querySelector('[data-field="craft-item"]');
    if (!field) return;
    let preview = content.querySelector(".craft-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "craft-preview hint";
      field.parentElement.after(preview);
    }
    const item = store.getState().inventory.find((i) => i.id === field.value);
    preview.textContent = !item
      ? "장비를 선택하면 현재 소켓과 룬워드를 확인할 수 있습니다."
      : item.identified === false
        ? "미감정 장비 · 먼저 감정해 주세요."
        : `소켓 ${(item.sockets || []).length}/2 · ${(item.sockets || []).map((r) => RUNES[r]?.name).join(" → ") || "비어 있음"}${item.runeword ? " · " + RUNEWORDS.find((w) => w.id === item.runeword)?.name + " 완성" : ""}`;
    if (item)
      preview.textContent += ` · 분해 시 별가루 ${GRADE_ORDER.indexOf(item.grade) + 1}개${item.identified === false ? ` · 감정 ${10 * (GRADE_ORDER.indexOf(item.grade) + 1)}G` : ""}`;
    const cube = content.querySelector('[data-field="cube-grade"]');
    if (cube) {
      let hint = content.querySelector(".cube-preview");
      if (!hint) {
        hint = document.createElement("div");
        hint.className = "cube-preview hint";
        cube.after(hint);
      }
      hint.textContent = cubePreview(store.getState(), cube.value);
    }
  }
  content.addEventListener("change", updateCraftPreview);
  let activeTab = "equipment",
    lastHtml = "",
    timer,
    pointerDown = false;
  function render() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (pointerDown) return;
      if (document.activeElement?.tagName === "SELECT") return;
      const html = renderTab(activeTab, {
        ...store.getState(),
        view: views[activeTab],
      });
      if (html !== lastHtml) {
        lastHtml = html;
        const scroll = content.scrollTop;
        const fields = Object.fromEntries(
          [...content.querySelectorAll("[data-field]")].map((el) => [
            el.dataset.field,
            el.value,
          ]),
        );
        content.innerHTML = html;
        content.querySelectorAll("[data-field]").forEach((el) => {
          if (
            fields[el.dataset.field] !== undefined &&
            [...el.options].some((o) => o.value === fields[el.dataset.field])
          )
            el.value = fields[el.dataset.field];
        });
        content.scrollTop = scroll;
        updateCraftPreview();
      }
    }, 50);
  }
  container.addEventListener("pointerdown", () => {
    pointerDown = true;
  });
  window.addEventListener("pointerup", () => {
    pointerDown = false;
    render();
  });
  window.addEventListener("pointercancel", () => {
    pointerDown = false;
    render();
  });
  container.querySelectorAll("[data-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      container
        .querySelectorAll("[data-tab]")
        .forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
      content.scrollTop = 0;
      render();
      sound("click");
    }),
  );
  content.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      views[activeTab] = viewButton.dataset.view;
      lastHtml = "";
      content.scrollTop = 0;
      render();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const state = store.getState(),
      action = button.dataset.action;
    let message = "";
    if (action === "cycle-auto-equip-grade") {
      state.settings.autoEquipMinGrade =
        GRADE_ORDER[
          (GRADE_ORDER.indexOf(state.settings.autoEquipMinGrade) + 1) %
            GRADE_ORDER.length
        ];
    }
    if (action === "toggle-setting") {
      const key = button.dataset.setting;
      state.settings[key] = state.settings[key] === false;
    }
    if (action === "learn-skill") {
      if (learnOrLevelSkill(state.character, button.dataset.skillId))
        message = "스킬을 강화했습니다.";
    }
    if (action === "equip-item") {
      if (equipInventoryItem(state, button.dataset.itemId))
        message = "장비를 장착했습니다.";
    }
    if (action === "unequip-item")
      message = unequipItem(state, button.dataset.itemId).message;
    if (action === "restore-scrapbook-item") {
      const result = restoreFromScrapbook(
        state.scrapbook,
        state.character,
        state.currency,
        button.dataset.itemId,
      );
      message = result.restored
        ? `${result.cost}G로 장비를 복원했습니다.`
        : "복원할 골드가 부족합니다.";
    }
    if (action === "pull-gacha") {
      const result = pullGacha({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        scrapbook: state.scrapbook,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
      if (result.success)
        state.lastPurchase = {
          item: result.item,
          destination: result.autoEquipResult.equipped
            ? "자동 장착"
            : result.convertedToGold
              ? `${result.convertedToGold}G 환산`
              : "인벤토리 보관",
        };
      message = result.success
        ? `${result.item.name} 획득! ${state.lastPurchase.destination}`
        : "골드가 부족합니다.";
      if (result.success) sound("reward");
    }
    const fields = Object.fromEntries(
      [...content.querySelectorAll("[data-field]")].map((el) => [
        el.dataset.field,
        el.value,
      ]),
    );
    const expansion = expansionAction(
      state,
      action,
      button.dataset.itemId,
      fields,
    );
    if (expansion) message = expansion.message;
    sound("click");
    saveState(state);
    store.notify();
    if (message) showToast(message);
  });
  const handle = container.querySelector(".panel-handle");
  let startY = null,
    dragged = false;
  const minimize = (value) => {
    container.classList.toggle("minimized", value);
    handle.setAttribute("aria-expanded", String(!value));
    handle.setAttribute(
      "aria-label",
      value ? "관리 패널 펼치기" : "관리 패널 접기",
    );
  };
  handle.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    dragged = false;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (startY !== null && Math.abs(e.clientY - startY) > 15) {
      dragged = true;
      minimize(e.clientY > startY);
    }
  });
  handle.addEventListener("pointerup", () => {
    startY = null;
  });
  handle.addEventListener("pointercancel", () => {
    startY = null;
  });
  handle.addEventListener("click", () => {
    if (!dragged) minimize(!container.classList.contains("minimized"));
    dragged = false;
  });
  setInterval(() => {
    content.querySelectorAll("[data-auction-end]").forEach((el) => {
      el.textContent = `${Math.max(0, Math.ceil((Number(el.dataset.auctionEnd) - Date.now()) / 1000))}초 남음`;
    });
  }, 1000);
  store.subscribe(render);
  render();
}
let toastTimer;
export function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3300);
}
