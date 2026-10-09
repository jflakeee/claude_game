const { chromium } = require('C:/Users/a/node_modules/playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = 'docs/qa/2026-10-09/deployment';
const url = 'https://www.fungood.co.kr/claude_game/';
const expectedBundle = '/claude_game/assets/index--mFeG0yT.js';
const key = 'claude_game_save_v1';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const checks = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    async function returnFromCombat() {
      const exit = page.getByRole('button', { name: /나가기/ });
      if (await exit.count()) {
        try {
          await exit.focus();
          await page.keyboard.press('Enter');
        }
        catch (error) {
          // Combat may naturally end while a slow screenshot is being captured.
          if (!(await page.locator('#result-dialog[open]').count())) throw error;
        }
      }
      await page.locator('#result-dialog[open]').waitFor();
      await page.getByRole('button', { name: '탐험 계속', exact: true }).click();
    }
    const response = await page.goto(`${url}?release=b5eb70e-${Date.now()}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('script[type="module"]').getAttribute('src'), expectedBundle);
    assert.equal(await page.evaluate(() => typeof window.__claudeGame), 'undefined');
    await page.locator('.survival-gate').waitFor();
    await page.screenshot({ path: `${out}/01-desktop.png` });
    await page.getByRole('button', { name: /보스 아레나/ }).click();
    await page.locator('.boss-panel').waitFor();
    await page.locator('.boss-introduction').waitFor({ state: 'detached' });
    await page.screenshot({ path: `${out}/02-boss.png` });
    await returnFromCombat();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: '설정' }).click();
    await page.getByRole('switch', { name: '화면 움직임', exact: true }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: '설정' }).click();
    assert.equal(await page.getByRole('switch', { name: '화면 움직임', exact: true }).getAttribute('aria-checked'), 'false');
    await page.locator('.survival-gate').click();
    await page.locator('.combat-hud').waitFor();
    await page.screenshot({ path: `${out}/03-mobile.png` });
    await returnFromCombat();
    checks.push('desktop boss and mobile survival return; preferences survive reload; production debug hook absent');
    await page.goto(`https://www.fungood.co.kr/game_portal/?release=b5eb70e-${Date.now()}#/play/claude-game`, { waitUntil: 'networkidle' });
    const frame = page.frameLocator('iframe');
    await frame.locator('.survival-gate').waitFor();
    assert.equal(await frame.locator('script[type="module"]').getAttribute('src'), expectedBundle);
    await page.screenshot({ path: `${out}/04-portal.png` });
    checks.push('portal iframe loads new release');
    await context.close();

    const legacy = JSON.stringify({ currency: { gold: 42 }, settings: { autoProgress: false }, progression: { firstGrowthComplete: true } });
    for (const [name, raw] of [['legacy', legacy], ['future', '{"schemaVersion":99,"currency":{"gold":999}}'], ['corrupt', '{broken']]) {
      const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await isolated.addInitScript(({ key, raw }) => {
        if (!sessionStorage.getItem('fixture-seeded')) {
          localStorage.setItem(key, raw);
          sessionStorage.setItem('fixture-seeded', 'yes');
        }
        const write = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === key && window.__failGameSave) throw new DOMException('Test quota failure', 'QuotaExceededError');
          return write.call(this, name, value);
        };
      }, { key, raw });
      const fixture = await isolated.newPage();
      fixture.on('pageerror', error => errors.push(error.message));
      await fixture.goto(`${url}?fixture=${name}-${Date.now()}`, { waitUntil: 'networkidle' });
      if (name === 'legacy') {
        await fixture.locator('.survival-gate').waitFor();
        await fixture.getByRole('tab', { name: '설정' }).click();
        await fixture.getByRole('switch', { name: '화면 움직임', exact: true }).click();
        const saved = await fixture.evaluate(key => ({ state: JSON.parse(localStorage.getItem(key)), backup: localStorage.getItem(`${key}_legacy_backup`) }), key);
        assert.equal(saved.backup, legacy);
        assert.equal(saved.state.currency.gold, 42);
        assert.equal(saved.state.schemaVersion, 1);
        await fixture.reload({ waitUntil: 'networkidle' });
        await fixture.getByRole('tab', { name: '설정' }).click();
        await fixture.evaluate(() => {
          document.querySelector('button[data-setting="motion"]').addEventListener('click', () => { window.__failGameSave = true; }, { capture: true, once: true });
        });
        await fixture.getByRole('switch', { name: '화면 움직임', exact: true }).click();
        await fixture.locator('#save-notice:visible').waitFor();
        await fixture.screenshot({ path: `${out}/05-save-failure.png` });
        await fixture.evaluate(() => {
          document.querySelector('#save-notice button').addEventListener('click', () => { window.__failGameSave = false; }, { capture: true, once: true });
        });
        await fixture.getByRole('button', { name: '저장 다시 시도' }).click();
        await fixture.waitForFunction(() => document.getElementById('save-notice').hidden);
        await fixture.reload({ waitUntil: 'networkidle' });
        await fixture.getByRole('tab', { name: '설정' }).click();
        assert.equal(await fixture.getByRole('switch', { name: '화면 움직임', exact: true }).getAttribute('aria-checked'), 'true');
        checks.push('legacy backup preserves gold; production UI reports failed save; retry persists preference');
      } else {
        await fixture.locator('#save-notice:visible').waitFor();
        assert.equal(await fixture.locator('canvas').count(), 0);
        assert.equal(await fixture.evaluate(key => localStorage.getItem(key), key), raw);
        await fixture.screenshot({ path: `${out}/blocked-${name}.png` });
        await fixture.getByRole('button', { name: '다시 불러오기' }).click();
        await fixture.waitForLoadState('networkidle');
        assert.equal(await fixture.evaluate(key => localStorage.getItem(key), key), raw);
        checks.push(`${name} record preserved and game startup blocked`);
      }
      await isolated.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ passed: true, source: 'b5eb70e', url, bundle: expectedBundle, status: response.status(), checks, errors }, null, 2));
    console.log('Production save protection verification passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
