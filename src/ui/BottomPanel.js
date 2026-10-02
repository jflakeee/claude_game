import { store } from '../state/globalStore.js';
import { GRADE_ORDER } from '../data/dropTable.js';

const TABS = ['equipment', 'skills', 'settings', 'shop'];
const TAB_LABELS = { equipment: '장비', skills: '스킬', settings: '설정', shop: '상점' };

export function renderTab(tab, state) {
  if (tab === 'equipment') {
    if (state.character.equippedItems.length === 0) {
      return '<ul><li>장착한 장비 없음</li></ul>';
    }
    return `<ul>${state.character.equippedItems
      .map((i) => `<li>${i.name} (${i.grade})</li>`)
      .join('')}</ul>`;
  }
  if (tab === 'skills') {
    return `<p>레벨 ${state.character.level} · 스킬 포인트 ${state.character.skillPoints}</p>`;
  }
  if (tab === 'settings') {
    return `
      <label>자동 장착 최소 등급: ${state.settings.autoEquipMinGrade}</label>
      <button data-action="cycle-auto-equip-grade" class="mock-button">등급 변경</button>
    `;
  }
  if (tab === 'shop') {
    return `<p>골드: ${state.currency.gold}</p>`;
  }
  return '';
}

export function mountBottomPanel(container) {
  container.innerHTML = `
    <div class="tab-bar">
      ${TABS.map((t) => `<button data-tab="${t}" class="tab-button">${TAB_LABELS[t]}</button>`).join('')}
    </div>
    <div class="tab-content"></div>
  `;

  const content = container.querySelector('.tab-content');
  let activeTab = 'equipment';

  function render() {
    content.innerHTML = renderTab(activeTab, store.getState());
  }

  container.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  content.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="cycle-auto-equip-grade"]');
    if (!button) return;
    const current = store.getState().settings.autoEquipMinGrade;
    const currentIndex = GRADE_ORDER.indexOf(current);
    const nextGrade = GRADE_ORDER[(currentIndex + 1) % GRADE_ORDER.length];
    store.setState({ settings: { ...store.getState().settings, autoEquipMinGrade: nextGrade } });
  });

  store.subscribe(render);
  render();
}
