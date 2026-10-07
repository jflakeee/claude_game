const { chromium } = require('C:/Users/a/node_modules/playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const out = 'docs/qa/2026-10-07/growth-guide';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/claude_game/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__claudeGame);
    await page.evaluate(() => {
      const state = window.__claudeGame.store.getState();
      state.character.equippedItems = [];
      state.inventory = [];
      state.progression.kills = 0;
      state.progression.firstGrowthComplete = false;
      state.settings.autoProgress = false;
      state.lastResult = null;
      window.__claudeGame.store.notify();
    });
    await page.locator('[data-growth-step="loot"]').waitFor();
    await page.screenshot({ path: `${out}/01-find-gear.png` });

    await page.evaluate(async () => {
      const { rollItem } = await import('/claude_game/src/systems/items.js');
      const { store } = window.__claudeGame;
      const state = store.getState();
      state.inventory.push({ ...rollItem(() => 0.5, { grade: 'rare', slot: 'weapon', identified: true }), id: 'first-guide-weapon' });
      store.notify();
    });
    await page.waitForTimeout(250);
    await page.locator('[data-growth-step="compare"]').waitFor({ timeout: 5000 });
    await page.locator('[data-growth-step="compare"] button').click();
    const comparison = page.locator('[data-comparison-id="first-guide-weapon"]');
    await page.waitForFunction(() => document.querySelector('[data-comparison-id="first-guide-weapon"]')?.open);
    assert.match(await comparison.innerText(), /공격/);
    await page.screenshot({ path: `${out}/02-compare.png` });

    await page.locator('[data-row-id="first-guide-weapon"] [data-action="equip-item"]').click();
    await page.evaluate(() => window.__claudeGame.store.notify());
    await page.waitForTimeout(300);
    const readyState = await page.evaluate(async () => {
      const { renderTab } = await import('/claude_game/src/ui/BottomPanel.js');
      const state = window.__claudeGame.store.getState();
      const expected = renderTab('equipment', { ...state, view: 'gear' });
      return {
      equipped: window.__claudeGame.store.getState().character.equippedItems.map(item => item.id),
      inventory: window.__claudeGame.store.getState().inventory.map(item => item.id),
      complete: window.__claudeGame.store.getState().progression.firstGrowthComplete,
      panelTab: document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab,
      expected: document.querySelector('.tab-content').innerText.slice(0, 160),
      directGuide: expected.match(/data-growth-step="[^"]+"/)?.[0] || null,
      guide: document.querySelector('[data-growth-step]')?.outerHTML || null,
      };
    });
    fs.writeFileSync(`${out}/debug.json`, JSON.stringify(readyState, null, 2));
    await page.locator('[data-growth-step="combat"]').waitFor();
    assert.match(await page.locator('[data-growth-step="combat"]').innerText(), /공격 \d+ · 방어 \d+/);
    await page.screenshot({ path: `${out}/03-ready.png` });
    await page.getByRole('button', { name: '생존 전투 시작' }).click();
    await page.locator('.combat-hud').waitFor();
    await page.evaluate(() => { window.__claudeGame.game.scene.getScene('CombatScene').session.kills = 1; });
    await page.getByRole('button', { name: /나가기/ }).click();
    await page.locator('#result-dialog[open]').waitFor();
    await page.getByRole('button', { name: '탐험 계속', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__claudeGame.store.getState().progression.firstGrowthComplete), true);
    assert.equal(await page.locator('#bottom-panel [data-growth-step]').count(), 0);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${out}/04-complete.png` });
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ passed: true, errors, steps: ['find first gear', 'compare stat changes', 'equip and review current stats', 'start explicit survival combat', 'hide guide after first kill'] }, null, 2));
    console.log('First growth flow passed');
  } finally { await browser.close(); }
})().catch(error => {
  fs.writeFileSync(`${out}/error.log`, error.stack || String(error));
  console.error(error);
  process.exit(1);
});
