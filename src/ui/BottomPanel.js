import { store } from "../state/globalStore.js";
import { GRADE_ORDER } from "../data/dropTable.js";
import { itemGoldValue, INVENTORY_CAPACITY } from "../systems/inventory.js";
import { restoreFromScrapbook } from "../systems/scrapbook.js";
import { GACHA_COST, pullGacha } from "../systems/shop.js";
import { SKILL_DEFS, learnOrLevelSkill } from "../data/skills.js";
import { computeEffectiveStats } from "../systems/effectiveStats.js";
import { GRADE_LABEL, equipInventoryItem } from "../systems/items.js";
import { saveState } from "../state/persistence.js";
import { sound } from "../audio.js";

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
function itemRow(item, action, label, status = "장착 중") {
  return `<li class="item-row"><span class="item-icon grade ${esc(item.grade)}">⚔</span><div class="item-info"><b>${esc(item.name)} (${esc(item.grade)})</b><small><span class="grade ${esc(item.grade)}">${gradeLabel(item.grade)}</span> · 공격 +${Number(item.statBonus?.atk) || 0} · 방어 +${Number(item.statBonus?.def) || 0}</small></div>${action ? `<button data-action="${action}" data-item-id="${esc(item.id)}">${label}</button>` : `<span class="equipped-label">${esc(status)}</span>`}</li>`;
}

export function renderTab(tab, state) {
  if (tab === "equipment")
    return `${gradeControl(state)}<div class="section-title">장착 장비 <span>WEAPON</span></div><ul class="item-list">${state.character.equippedItems.length ? state.character.equippedItems.map((i) => itemRow(i)).join("") : '<li class="empty-state">장착한 장비 없음 · 탐험하며 장비를 찾아보세요.</li>'}</ul><div class="section-title">인벤토리 <span>${(state.inventory || []).length}/${INVENTORY_CAPACITY}</span></div><ul class="item-list">${(state.inventory || []).map((i) => itemRow(i, "equip-item", "장착")).join("") || '<li class="empty-state">새로운 장비가 이곳에 모입니다.</li>'}</ul><p class="hint">가방이 가득 차면 새 장비는 자동으로 골드가 됩니다.</p><div class="section-title">스크랩북 <span>${(state.scrapbook || []).length}개</span></div><ul class="item-list">${(state.scrapbook || []).map((i) => itemRow(i, "restore-scrapbook-item", `${itemGoldValue(i)}G 복원`)).join("") || '<li class="empty-state">스크랩북이 비어 있습니다.</li>'}</ul>`;
  if (tab === "skills") {
    const stats = computeEffectiveStats({
      ...state.character,
      stats: state.character.stats || { atk: 10, def: 5 },
      equippedItems: state.character.equippedItems || [],
    });
    return `<div class="section-title">레벨 ${state.character.level} <span>스킬 포인트 ${state.character.skillPoints}</span></div><div class="stats-grid"><div><small>공격력</small><strong>${stats.atk}</strong></div><div><small>방어력</small><strong>${stats.def}</strong></div><div><small>치명타</small><strong>${Math.round((state.character.stats?.crit ?? 0.05) * 100)}%</strong></div></div><p class="hint">장비와 패시브가 반영된 수치 · 치명타 피해 2배</p>${Object.values(
      SKILL_DEFS,
    )
      .map((def) => {
        const level = state.character.skills[def.id] || 0;
        return `<div class="skill-row"><span class="skill-icon">${def.id === "power_strike" ? "✦" : "⬡"}</span><div><b>${def.name} <small>Lv.${level}/${def.maxLevel}</small></b><p>${def.id === "power_strike" ? "공격력" : "방어력"} +${level * 10}% · 단계마다 10%</p></div><button data-action="learn-skill" data-skill-id="${def.id}" ${level >= def.maxLevel || !state.character.skillPoints ? "disabled" : ""}>${level >= def.maxLevel ? "최대" : "투자"}</button></div>`;
      })
      .join("")}`;
  }
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
    return `<div class="shop-card"><span class="shop-orb">✧</span><span class="eyebrow">STARLIGHT CHEST</span><h2>별빛 장비 상자</h2><p>작은 행운이 다음 탐험을 바꿉니다.</p><div class="odds"><span>일반 60%</span><span class="magic">고급 25%</span><span class="rare">희귀 12%</span><span class="epic">영웅 3%</span></div><button class="primary" data-action="pull-gacha" ${state.currency.gold < GACHA_COST ? "disabled" : ""}>뽑기 (${GACHA_COST}골드)</button><small>골드: ${state.currency.gold} · 자동 장착 기준 적용</small></div>${state.lastPurchase ? `<div class="section-title">방금 획득한 장비 <span>${esc(state.lastPurchase.destination)}</span></div><ul class="item-list">${itemRow(state.lastPurchase.item, null, null, state.lastPurchase.destination)}</ul>` : ""}`;
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
  let activeTab = "equipment",
    lastHtml = "",
    timer,
    pointerDown = false;
  function render() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (pointerDown) return;
      const html = renderTab(activeTab, store.getState());
      if (html !== lastHtml) {
        lastHtml = html;
        const scroll = content.scrollTop;
        content.innerHTML = html;
        content.scrollTop = scroll;
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
