const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const URL = "http://127.0.0.1:5173/claude_game/";

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Fail quickly and preserve diagnostics instead of hanging a CI runner.
  const timeout = setTimeout(() => { console.error("P0 browser acceptance timeout"); process.exit(2); }, 90000);
  timeout.unref();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__claudeGame);
  assert.equal(await page.locator("#app").isVisible(), true);
  assert.equal(await page.evaluate(() => !!navigator.locks?.request), true);

  const second = await context.newPage();
  second.on("pageerror", error => errors.push(error.message));
  await second.goto(URL, { waitUntil: "networkidle" });
  assert.equal(await second.locator("#app").isVisible(), false);
  assert.match(await second.locator("#writer-conflict").innerText(), /다른 탭/);

  // A rejected save cannot publish a new wallet value.
  const result = await page.evaluate(() => {
    const game = window.__claudeGame;
    const before = game.store.getState().currency.gold;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "claude_game_save_v1") throw new Error("quota");
      return original.call(this, key, value);
    };
    try {
      const candidate = structuredClone(game.store.getState());
      candidate.currency.gold += 99;
      const saved = game.save();
      return { before, after: game.store.getState().currency.gold, saved: saved?.ok };
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  assert.equal(result.before, result.after);
  assert.equal(result.saved, false);

  await second.close();

  // Exercise the real Phaser combat scene's failed final settlement.
  await page.locator("canvas").click({ position: { x: 180, y: 150 } });
  await page.waitForFunction(() => window.__claudeGame.game.scene.getScene("CombatScene").scene.isActive());
  const combat = await page.evaluate(() => {
    const game = window.__claudeGame;
    const scene = game.game.scene.getScene("CombatScene");
    scene.session.rewards.gold = 13;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "claude_game_save_v1") throw new Error("quota");
      return original.call(this, key, value);
    };
    try {
      scene.endCombat("escaped");
      return {
        pending: game.store.getState().combatSession !== null,
        gold: game.store.getState().currency.gold,
        active: scene.scene.isActive(),
      };
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  assert.equal(combat.pending, true);
  assert.equal(combat.gold, 0);
  assert.equal(combat.active, true);
  await page.evaluate(() => window.__claudeGame.game.scene.getScene("CombatScene").endCombat("escaped"));
  await page.waitForFunction(() => window.__claudeGame.store.getState().combatSession === null);
  assert.equal(await page.evaluate(() => window.__claudeGame.store.getState().currency.gold), 13);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__claudeGame);
  assert.equal(await page.locator("#app").isVisible(), true);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("PASS: browser startup, second tab blocked, failed save, combat settlement retry, reload");
})().catch(error => { console.error(error); process.exitCode = 1; });
