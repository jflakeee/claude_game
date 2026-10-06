const { chromium } = require('C:/Users/a/node_modules/playwright-core');
const fs = require('node:fs');

const cpuThrottle = Number(process.argv[2] || 4);
const output = `docs/qa/2026-10-06/deployment/performance-${cpuThrottle}x.json`;
fs.mkdirSync('docs/qa/2026-10-06/deployment', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    const response = await page.goto(`https://www.fungood.co.kr/claude_game/?perf=${Date.now()}`, { waitUntil: 'networkidle' });
    const measure = (durationMs = 5000) => page.evaluate(durationMs => new Promise(resolve => {
      const deltas = [];
      let previous = performance.now();
      const start = previous;
      const frame = now => {
        deltas.push(now - previous);
        previous = now;
        if (now - start < durationMs) requestAnimationFrame(frame);
        else {
          const ordered = [...deltas].sort((a, b) => a - b);
          resolve({
            durationMs: Math.round(now - start), frames: deltas.length,
            averageFps: +(deltas.length * 1000 / (now - start)).toFixed(1),
            p95FrameMs: +ordered[Math.floor(ordered.length * 0.95)].toFixed(1),
            over32msPercent: +(100 * deltas.filter(delta => delta > 32).length / deltas.length).toFixed(1),
            heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
          });
        }
      };
      requestAnimationFrame(frame);
    }), durationMs);
    await page.waitForTimeout(1000);
    const idle = await measure();
    await page.getByRole('button', { name: /생존 전투/ }).click();
    await page.waitForSelector('.combat-hud');
    await page.waitForTimeout(1500);
    const combat = await measure();
    const bundle = await page.locator('script[type="module"]').getAttribute('src');
    if (!bundle.includes('index-2Rgyv_5u')) throw new Error(`Unexpected deployed bundle: ${bundle}`);
    const result = { source: '957ab50', bundle, cpuThrottle, viewport: '390x844', status: response.status(), idle, combat, errors };
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(result);
    await context.close();
    if (response.status() !== 200 || errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
