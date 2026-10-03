import { store } from '../state/globalStore.js';
import { GRADE_ORDER } from '../data/dropTable.js';
import { itemGoldValue } from '../systems/inventory.js';
import { restoreFromScrapbook } from '../systems/scrapbook.js';
import { GACHA_COST, pullGacha } from '../systems/shop.js';
import { SKILL_DEFS, learnOrLevelSkill } from '../data/skills.js';

const TABS = ['equipment', 'skills', 'settings', 'shop'];
const TAB_LABELS = { equipment: '장비', skills: '스킬', settings: '설정', shop: '상점' };

export function renderTab(tab, state) {
  if (tab === 'equipment') {
    const equippedHtml = state.character.equippedItems.length === 0
      ? '<li>장착한 장비 없음</li>'
      : state.character.equippedItems.map((i) => `<li>${i.name} (${i.grade})</li>`).join('');
    const scrapbook = state.scrapbook || [];
    const scrapbookHtml = scrapbook.length === 0
      ? '<p>스크랩북이 비어 있습니다.</p>'
      : `<ul>${scrapbook
          .map(
            (i) =>
              `<li>${i.name} (${i.grade}) · ${itemGoldValue(i)}G <button data-action="restore-scrapbook-item" data-item-id="${i.id}" class="mock-button">복원</button></li>`
          )
          .join('')}</ul>`;
    return `<ul>${equippedHtml}</ul><div class="section"><p class="label">스크랩북</p>${scrapbookHtml}</div>`;
  }
  if (tab === 'skills') {
    const skillsHtml = Object.values(SKILL_DEFS)
      .map((def) => {
        const level = state.character.skills[def.id] || 0;
        return `<p>${def.name} Lv.${level}/${def.maxLevel} <button data-action="learn-skill" data-skill-id="${def.id}" class="mock-button">투자</button></p>`;
      })
      .join('');
    return `<p>레벨 ${state.character.level} · 스킬 포인트 ${state.character.skillPoints}</p>${skillsHtml}`;
  }
  if (tab === 'settings') {
    return `
      <label>자동 장착 최소 등급: ${state.settings.autoEquipMinGrade}</label>
      <button data-action="cycle-auto-equip-grade" class="mock-button">등급 변경</button>
    `;
  }
  if (tab === 'shop') {
    return `
      <p>골드: ${state.currency.gold}</p>
      <button data-action="pull-gacha" class="mock-button">뽑기 (${GACHA_COST}골드)</button>
    `;
  }
  return '';
}

export function mountBottomPanel(container) {
  container.innerHTML = `
    <div class="panel-handle" data-role="drag-handle"></div>
    <div class="tab-bar">
      ${TABS.map((t) => `<button data-tab="${t}" class="tab-button">${TAB_LABELS[t]}</button>`).join('')}
    </div>
    <div class="tab-content"></div>
  `;

  const content = container.querySelector('.tab-content');
  let activeTab = 'equipment';

  let lastHtml = null;
  let renderTimer = null;

  function render() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const html = renderTab(activeTab, store.getState());
      if (html === lastHtml) return;
      lastHtml = html;
      content.innerHTML = html;
    }, 50);
  }

  container.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  content.addEventListener('click', (event) => {
    const cycleBtn = event.target.closest('[data-action="cycle-auto-equip-grade"]');
    if (cycleBtn) {
      const current = store.getState().settings.autoEquipMinGrade;
      const currentIndex = GRADE_ORDER.indexOf(current);
      const nextGrade = GRADE_ORDER[(currentIndex + 1) % GRADE_ORDER.length];
      store.setState({ settings: { ...store.getState().settings, autoEquipMinGrade: nextGrade } });
      return;
    }

    const restoreBtn = event.target.closest('[data-action="restore-scrapbook-item"]');
    if (restoreBtn) {
      const state = store.getState();
      restoreFromScrapbook(state.scrapbook, state.character, state.currency, restoreBtn.dataset.itemId);
      store.notify();
      return;
    }

    const gachaBtn = event.target.closest('[data-action="pull-gacha"]');
    if (gachaBtn) {
      const state = store.getState();
      pullGacha({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        scrapbook: state.scrapbook,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
      store.notify();
      return;
    }

    const learnBtn = event.target.closest('[data-action="learn-skill"]');
    if (learnBtn) {
      const state = store.getState();
      learnOrLevelSkill(state.character, learnBtn.dataset.skillId);
      store.notify();
      return;
    }
  });

  const handle = container.querySelector('[data-role="drag-handle"]');
  let dragStartY = null;

  handle.addEventListener('pointerdown', (event) => {
    dragStartY = event.clientY;
  });

  handle.addEventListener('pointerup', (event) => {
    if (dragStartY === null) return;
    const deltaY = event.clientY - dragStartY;
    dragStartY = null;

    if (deltaY > 15) {
      container.classList.add('minimized');
    } else {
      container.classList.remove('minimized');
    }
  });

  handle.addEventListener('pointercancel', () => {
    dragStartY = null;
  });

  store.subscribe(render);
  render();
}
