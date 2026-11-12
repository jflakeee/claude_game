const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const URL = "http://127.0.0.1:5173/claude_game/";

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Fail quickly and preserve diagnostics instead of hanging a CI runner.
  const timeout = setTimeout(() => { console.error("P0 browser acceptance timeout"); process.exit(2); }, 90000);
  timeout.unref();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__claudeGame);
  assert.equal(await page.locator("#app").isVisible(), true);
  assert.equal(await page.evaluate(() => !!navigator.locks?.request), true);
  assert.equal(await page.evaluate(() => navigator.maxTouchPoints > 0), true);
  // Mobile viewport: core controls must remain reachable without horizontal overflow.
  const mobile = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    gate: (() => {
      const rect = document.querySelector(".survival-gate")?.getBoundingClientRect();
      return rect && { width: rect.width, left: rect.left, right: rect.right };
    })(),
  }));
  assert.ok(mobile.documentWidth <= mobile.viewportWidth + 2, "Unexpected mobile horizontal overflow");
  assert.ok(mobile.gate?.width > 40, "Survival button must have a usable touch target");
  assert.ok(mobile.gate.left >= 0 && mobile.gate.right <= mobile.viewportWidth + 2, "Survival button must fit viewport");

  // Simulate device rotation without changing the real device or browser engine.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    const gate = document.querySelector(".survival-gate")?.getBoundingClientRect();
    return gate?.width > 40 && gate.left >= 0 && gate.right <= document.documentElement.clientWidth + 2;
  }, null, { timeout: 10000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".survival-gate").isVisible(), true);

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
  // Combat is entered through the expedition action, not a canvas click.
  await page.locator(".survival-gate").tap();
  await page.waitForFunction(() => window.__claudeGame.game.scene.getScene("CombatScene").scene.isActive(), { timeout: 10000 });
  const combat = await page.evaluate(() => {
    const game = window.__claudeGame;
    const scene = game.game.scene.getScene("CombatScene");
    scene.session.rewards.gold = 13;
    const initialGold = game.store.getState().currency.gold;
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
        initialGold,
        active: scene.scene.isActive(),
      };
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  assert.equal(combat.pending, true);
  assert.equal(combat.gold, combat.initialGold);
  assert.equal(combat.active, true);
  await page.evaluate(() => window.__claudeGame.game.scene.getScene("CombatScene").endCombat("escaped"));
  await page.waitForFunction(() => window.__claudeGame.store.getState().combatSession === null);
  assert.equal(await page.evaluate(() => window.__claudeGame.store.getState().currency.gold), combat.initialGold + 13);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__claudeGame);
  assert.equal(await page.locator("#app").isVisible(), true);
  // A successful settlement must remain durable across a real page reload.
  assert.equal(
    await page.evaluate(() => window.__claudeGame.store.getState().currency.gold),
    combat.initialGold + 13,
  );
  assert.equal(
    await page.evaluate(() => window.__claudeGame.store.getState().combatSession),
    null,
  );
  // Closing the owner tab must allow a new tab to acquire the writer.
  await page.close();
  const successor = await context.newPage();
  successor.on("pageerror", error => errors.push(error.message));
  await successor.goto(URL, { waitUntil: "networkidle" });
  await successor.waitForFunction(() => !!window.__claudeGame);
  assert.equal(await successor.locator("#app").isVisible(), true);
  // Simultaneous navigation must produce exactly one active writer.
  await successor.close();
  const contenders = await Promise.all(Array.from({ length: 4 }, () => context.newPage()));
  for (const contender of contenders) contender.on("pageerror", error => errors.push(error.message));
  await Promise.all(contenders.map(contender => contender.goto(URL, { waitUntil: "networkidle" })));
  const visible = await Promise.all(contenders.map(contender => contender.locator("#app").isVisible()));
  assert.equal(visible.filter(Boolean).length, 1, "Exactly one concurrent tab may write");
  const activeIndex = visible.indexOf(true);
  for (let i = 0; i < contenders.length; i++) {
    if (i !== activeIndex) {
      assert.match(await contenders[i].locator("#writer-conflict").innerText(), /다른 탭/);
    }
  }
  await Promise.all(contenders.map(contender => contender.close()));
  // A pre-schema save is hydrated without dropping its existing gold.
  const legacy = await context.newPage();
  legacy.on("pageerror", error => errors.push(error.message));
  await legacy.goto(URL, { waitUntil: "networkidle" });
  await legacy.waitForFunction(() => !!window.__claudeGame);
  // Install the legacy fixture before the app boots: pagehide persistence
  // would otherwise overwrite an injected fixture with the current state.
  await legacy.close();
  const legacyReader = await context.newPage();
  legacyReader.on("pageerror", error => errors.push(error.message));
  await legacyReader.addInitScript(() => {
    const key = "claude_game_save_v1";
    const state = JSON.parse(localStorage.getItem(key));
    delete state.schemaVersion;
    delete state.revision;
    state.currency.gold = 77;
    localStorage.setItem(key, JSON.stringify(state));
  });
  await legacyReader.goto(URL, { waitUntil: "networkidle" });
  await legacyReader.waitForFunction(() => !!window.__claudeGame);
  assert.equal(await legacyReader.evaluate(() => window.__claudeGame.store.getState().currency.gold), 77);
  assert.equal(await legacyReader.locator("#app").isVisible(), true);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("PASS: mobile touch expedition, browser startup, tab exclusion and handoff, failed save, durable combat settlement retry, reload, four-way writer race, legacy hydration");
})().catch(error => { console.error(error); process.exit(1); });
