const { chromium } = require('C:/Users/a/node_modules/playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = 'docs/qa/2026-10-09/save-protection';
const url = process.env.GAME_TEST_URL || 'http://127.0.0.1:5174/claude_game/';
const key = 'claude_game_save_v1';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const checks = [];
  try {
    async function setup(raw, unavailable = false) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addInitScript(({ raw, unavailable, key }) => {
        const originalSet = Storage.prototype.setItem;
        const originalGet = Storage.prototype.getItem;
        if (!sessionStorage.getItem('fixture-seeded')) {
          if (raw !== null) originalSet.call(localStorage, key, raw);
          sessionStorage.setItem('fixture-seeded', 'yes');
        }
        Storage.prototype.setItem = function (name, value) {
          if (name === key && window.__failGameSave) throw new DOMException('Test quota failure', 'QuotaExceededError');
          return originalSet.call(this, name, value);
        };
        Storage.prototype.getItem = function (name) {
          if (name === key && unavailable) throw new DOMException('Test access failure', 'SecurityError');
          return originalGet.call(this, name);
        };
      }, { raw, unavailable, key });
      const page = await context.newPage();
      context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url, { waitUntil: 'networkidle' });
      return { context, page };
    }
    const legacy = JSON.stringify({ currency: { gold: 42 }, settings: { autoProgress: false }, progression: { firstGrowthComplete: true } });
    {
      const { context, page } = await setup(legacy);
      await page.waitForFunction(() => window.__claudeGame);
      await page.screenshot({ path: `${out}/01-normal.png` });
      const migration = await page.evaluate(key => {
        const state = window.__claudeGame.store.getState();
        const result = window.__claudeGame.save();
        return { result, gold: state.currency.gold, backup: localStorage.getItem(`${key}_legacy_backup`) };
      }, key);
      assert.equal(migration.result.ok, true);
      assert.equal(migration.gold, 42);
      assert.equal(migration.backup, legacy);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__claudeGame);
      assert.equal(await page.evaluate(() => window.__claudeGame.store.getState().currency.gold), 42);
      checks.push('legacy backup and reload preserve progress');

      const failure = await page.evaluate(() => {
        window.__failGameSave = true;
        const state = window.__claudeGame.store.getState();
        state.currency.gold = 77;
        const results = [];
        for (let i = 0; i < 3; i++) results.push(window.__claudeGame.save());
        return { results, notice: document.getElementById('save-notice')?.outerHTML };
      });
      fs.writeFileSync(`${out}/failure-state.json`, JSON.stringify(failure, null, 2));
      assert.equal(await page.locator('#save-notice:visible').count(), 1);
      assert.match(await page.locator('#save-notice').innerText(), /저장하지 못했습니다/);
      for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        const bounds = await page.locator('#save-notice').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= height);
        await page.screenshot({ path: `${out}/failure-${width}.png` });
      }
      await page.evaluate(() => {
        document.querySelector('#save-notice button').addEventListener('click', () => { window.__failGameSave = false; }, { capture: true, once: true });
      });
      await page.getByRole('button', { name: '저장 다시 시도' }).focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('save-notice').hidden);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).currency.gold, key), 77);
      checks.push('failed writes show one notice; keyboard retry saves progress');
      await page.evaluate(() => {
        document.getElementById('result-dialog').showModal();
        window.__failGameSave = true;
        window.__claudeGame.save();
      });
      await page.waitForFunction(() => document.querySelector('#result-dialog #save-notice'));
      await page.screenshot({ path: `${out}/failure-modal.png` });
      await page.evaluate(() => {
        document.querySelector('#save-notice button').addEventListener('click', () => { window.__failGameSave = false; }, { capture: true, once: true });
      });
      await page.getByRole('button', { name: '저장 다시 시도' }).click();
      await page.waitForFunction(() => document.getElementById('save-notice').hidden);
      await page.evaluate(() => document.getElementById('result-dialog').close());
      checks.push('save retry remains usable inside native modal');
      await context.close();
    }
    for (const [name, raw, unavailable] of [['future', '{"schemaVersion":99,"currency":{"gold":999}}', false], ['corrupt', '{broken', false], ['unavailable', null, true]]) {
      const { context, page } = await setup(raw, unavailable);
      await page.locator('#save-notice:visible').waitFor();
      assert.equal(await page.locator('canvas').count(), 0);
      assert.equal(await page.locator('#app').isVisible(), false);
      if (!unavailable) assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw);
      await page.screenshot({ path: `${out}/blocked-${name}.png` });
      await page.getByRole('button', { name: '다시 불러오기' }).click();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('canvas').count(), 0);
      if (!unavailable) assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw);
      checks.push(`${name} startup blocks game without overwriting save`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ passed: true, url, checks, errors }, null, 2));
    console.log('Save protection browser checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
