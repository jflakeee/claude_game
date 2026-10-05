const { chromium } = require('C:/Users/a/node_modules/playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = 'docs/qa/2026-10-05/redesign';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5174/claude_game/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__claudeGame);
    await page.evaluate(async () => {
      const { rollItem } = await import('/claude_game/src/systems/items.js');
      const { store } = window.__claudeGame;
      const s = store.getState();
      s.settings.autoProgress = false;
      s.character.equippedItems = ['weapon', 'armor'].map((slot, i) => ({
        ...rollItem(() => 0.5, { grade: 'set', slot, identified: true }), id: `set-${i}`,
      }));
      s.inventory = [{ ...rollItem(() => 0.5, { grade: 'unique', slot: 'weapon', identified: true }), id: 'candidate' }];
      s.currency.gold = 400;
      store.notify();
    });
    await page.locator('[data-comparison-id="candidate"] summary').click();
    await page.getByRole('button', { name: '장비 유지', exact: true }).first().click();
    await page.getByRole('button', { name: '유지 중', exact: true }).waitFor();
    assert.match(await page.locator('[data-comparison-id="candidate"]').innerText(), /31 → 27/);
    assert.match(await page.locator('[data-comparison-id="candidate"]').innerText(), /2세트/);
    const desktop = await page.evaluate(() => ({
      app: document.querySelector('#app').getBoundingClientRect().width,
      game: document.querySelector('#game-container').getBoundingClientRect().width,
      panel: document.querySelector('#bottom-panel').getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    assert.ok(desktop.app > 1000 && desktop.panel >= 380);
    assert.equal(desktop.overflow, false);
    await page.screenshot({ path: out + '/01-desktop.png' });
    // Background taps are now observation, not implicit departure.
    await page.locator('canvas').click({ position: { x: 150, y: 200 } });
    assert.equal(await page.evaluate(() => window.__claudeGame.game.scene.isActive('IdleScene')), true);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__claudeGame?.store.getState().character.equippedItems.some(i => i.autoEquipLocked));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out + '/02-mobile.png' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(250);
    const compact = await page.evaluate(() => {
      const scene = window.__claudeGame.game.scene.getScene('IdleScene');
      const canvas = scene.game.canvas.getBoundingClientRect();
      const actions = document.querySelector('.expedition-actions').getBoundingClientRect();
      return { heroBottom: canvas.top + scene.character.y + 24, actionsTop: actions.top,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(compact.heroBottom < compact.actionsTop, JSON.stringify(compact));
    assert.equal(compact.overflow, false);
    await page.screenshot({ path: out + '/04-compact.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /생존 전투/ }).click();
    await page.waitForSelector('.combat-hud');
    const mobileCombat = await page.locator('#game-container').evaluate(el => el.clientWidth);
    assert.equal(mobileCombat, 390);
    await page.getByRole('button', { name: /나가기/ }).click();
    await page.getByRole('button', { name: '탐험 계속', exact: true }).click();
    await page.getByRole('button', { name: /보스 아레나/ }).click();
    await page.waitForSelector('.boss-panel');
    await page.evaluate(() => { window.__claudeGame.game.scene.getScene('CombatScene').introUntil = 0; });
    await page.waitForSelector('.boss-introduction', { state: 'detached' });
    await page.evaluate(() => {
      const s = window.__claudeGame.game.scene.getScene('CombatScene');
      s.arena.spawn = s.arena.packTimer = s.arena.patternTimer = s.arena.attack = 999;
      s.arena.hazards = [
        { type: 'charge', x: 70, y: 360, tx: 300, ty: 540, delay: 10, life: 1, active: false },
        { type: 'nova', x: 280, y: 320, delay: 10, life: 1, active: false },
        { type: 'blast', x: 90, y: 630, radius: 48, delay: 10, life: 1, active: false },
      ];
      s.update(s.game.loop.time, 16);
      s.scene.pause();
    });
    await page.waitForTimeout(100);
    await page.screenshot({ path: out + '/03-hazards.png' });
    await page.getByRole('button', { name: /나가기/ }).click();
    await page.getByRole('button', { name: '탐험 계속', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: /생존 전투/ }).click();
    await page.waitForSelector('.combat-hud');
    assert.equal(await page.locator('#app').evaluate(el => el.clientWidth), 520);
    await page.getByRole('button', { name: /나가기/ }).click();
    await page.getByRole('button', { name: '탐험 계속', exact: true }).click();
    assert.ok(await page.locator('#app').evaluate(el => el.clientWidth) > 1000);
    await page.locator('[data-action="equip-item"][data-item-id="candidate"]').click();
    assert.equal(await page.evaluate(() => window.__claudeGame.store.getState().character.equippedItems.some(i => i.id === 'candidate')), true);
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/results.json', JSON.stringify({ passed: true, errors, desktop, mobileCombat, compact,
      checks: ['comparison reflects set loss', 'lock saved and restored', 'manual replacement allowed while locked', 'details retained after state render', 'explicit departure only', 'mobile layout', 'hazard render fixture', 'desktop combat width preserved', 'return restores wide preparation', 'reduced motion flow'] }, null, 2));
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
