const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const URL = "http://127.0.0.1:5173/claude_game/";
const sample = durationMs => new Promise(resolve => {
  const deltas = [];
  let previous = performance.now();
  const started = previous;
  function frame(now) {
    if (deltas.length) deltas.push(now - previous);
    else deltas.push(now - previous);
    previous = now;
    if (now - started < durationMs) requestAnimationFrame(frame);
    else {
      const sorted = [...deltas].sort((a, b) => a - b);
      resolve({
        frames: deltas.length,
        averageFps: Number((deltas.length * 1000 / (now - started)).toFixed(1)),
        p95FrameMs: Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(1)),
        over32msPercent: Number((deltas.filter(ms => ms > 32).length * 100 / deltas.length).toFixed(1)),
        heapBytes: performance.memory?.usedJSHeapSize ?? null,
      });
    }
  }
  requestAnimationFrame(frame);
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.__claudeGame);
    const idle = await page.evaluate(sample, 2000);
    await page.locator(".survival-gate").tap();
    await page.waitForFunction(() => window.__claudeGame.game.scene.getScene("CombatScene").scene.isActive());
    const combat = await page.evaluate(sample, 3000);
    const result = {
      environment: "headless Chromium; mobile emulation; 4x CPU throttling; not a physical device",
      viewport: "390x844", idle, combat, errors,
    };
    fs.writeFileSync("mobile-combat-performance.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    assert.deepEqual(errors, []);
    assert.ok(idle.frames > 10 && combat.frames > 10, "Insufficient animation frames");
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
