const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");

(async () => {
  fs.mkdirSync("readme-preview", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://127.0.0.1:5173/claude_game/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.__claudeGame);
    await page.screenshot({ path: "readme-preview/frame-00.png" });
    await page.locator(".survival-gate").tap();
    await page.waitForFunction(() => window.__claudeGame.game.scene.getScene("CombatScene").scene.isActive());
    for (let i = 1; i <= 8; i++) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `readme-preview/frame-${String(i).padStart(2, "0")}.png` });
    }
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
