const { chromium } = require("C:/Users/a/node_modules/playwright-core");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const out = "docs/qa/2026-10-04/reaudit";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true }),
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await context.newPage(),
    errors = [],
    checks = [];
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(e.message));
  const gear = (id) => ({
    id,
    name: id === "gear" ? "별빛 시험 지팡이" : `합성 재료 ${id}`,
    grade: "normal",
    slot: "weapon",
    identified: true,
    sockets: [],
    statBonus: { atk: 2, def: 1 },
  });
  await page.addInitScript(
    (s) => {
      if (!sessionStorage.seeded) {
        localStorage.setItem("claude_game_save_v1", JSON.stringify(s));
        sessionStorage.seeded = "yes";
      }
    },
    {
      character: {
        level: 10,
        stats: { atk: 1, def: 0, crit: 0 },
        skills: {
          power_strike: 3,
          iron_skin: 3,
          piercing: 1,
          chill: 3,
          fury: 1,
        },
        activeAura: "fury",
        activeCurse: "chill",
        equippedItems: [gear("gear")],
      },
      inventory: ["A", "B", "C"].map(gear),
      currency: { gold: 1000 },
      materials: { ember: 6, frost: 6, ward: 6, dust: 0 },
      settings: { autoProgress: false, sound: false, notifications: true },
    },
  );
  await page.goto(
    process.env.GAME_URL || "http://127.0.0.1:5173/claude_game/",
    { waitUntil: "networkidle" },
  );
  const local = await page.evaluate(() => !!window.__claudeGame);
  const shot = (name) =>
    page.screenshot({
      path: `${out}/${process.env.GAME_URL ? "live-" : ""}${name}.png`,
    });
  await page
    .locator('[data-action="unequip-item"][data-item-id="gear"]')
    .click();
  await page
    .locator('[data-action="equip-item"][data-item-id="gear"]')
    .waitFor();
  checks.push("equipped gear to inventory");
  await page.locator('[data-view="craft"]').click();
  await page.locator('[data-field="craft-item"]').selectOption("gear");
  await page.locator('[data-field="rune"]').selectOption("ember");
  for (let n = 0; n < 2; n++) {
    await page.locator('[data-action="socket"]').click();
    await page.waitForTimeout(120);
  }
  await page.locator(".craft-preview").scrollIntoViewIfNeeded();
  await page
    .locator(".craft-preview")
    .filter({ hasText: "잿불 완성" })
    .waitFor();
  await shot("crafted-equipped-gear");
  checks.push("craft equipped item and current socket preview");
  await page.locator(".cube-preview").scrollIntoViewIfNeeded();
  assert.match(
    await page.locator(".cube-preview").innerText(),
    /합성 재료 A \+ 합성 재료 B \+ 합성 재료 C/,
  );
  await shot("cube-material-preview");
  checks.push("exact cube materials preview");
  await page.locator('[data-action="cube"]').click();
  await page.waitForTimeout(150);
  assert.match(await page.locator(".cube-preview").innerText(), /재료 부족/);
  await page.locator('[data-view="gear"]').click();
  await page.locator('[data-action="equip-item"][data-item-id="gear"]').click();
  await page
    .locator('[data-action="unequip-item"][data-item-id="gear"]')
    .waitFor();
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByRole("switch", { name: "자동 진행", exact: true }).click();
  if (local) {
    await page.evaluate(async () => {
      const c = window.__claudeGame.game.scene.getScene("IdleScene");
      c.idleEnemy.hp = 1000;
      await new Promise((resolve) => {
        function frame() {
          if (c.idleEnemy.curseTimer > 0) {
            c.scene.pause();
            resolve();
          } else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    });
    await shot("idle-aura-curse");
    await page.evaluate(() => {
      const s = window.__claudeGame.store.getState();
      s.lootNotice = {
        id: "visual-rare",
        message: "희귀 장비 획득! 가방에서 감정하세요.",
      };
      window.__claudeGame.store.notify();
    });
    await page.locator("#toast.visible").waitFor();
    await shot("rare-drop-notice");
    await page.evaluate(() =>
      window.__claudeGame.game.scene.resume("IdleScene"),
    );
  } else {
    await page.waitForTimeout(1200);
    await shot("idle-aura-curse");
  }
  checks.push("idle aura curse presentation");
  await page.locator(".boss-gate").click();
  await page.locator("#boss-name").waitFor();
  if (local)
    await page.evaluate(() =>
      window.__claudeGame.game.scene.pause("CombatScene"),
    );
  for (const size of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    if (local)
      await page.evaluate(async () => {
        const c = window.__claudeGame.game.scene.getScene("CombatScene");
        c.arena.attack = 999;
        c.arena.patternTimer = 999;
        c.scene.resume();
        await new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              c.scene.pause();
              resolve();
            }),
          ),
        );
      });
    const dims = await page.evaluate(() => ({
      canvas: document.querySelector("canvas").getBoundingClientRect().toJSON(),
      parent: document
        .querySelector("#game-container")
        .getBoundingClientRect()
        .toJSON(),
    }));
    assert.ok(Math.abs(dims.canvas.width - dims.parent.width) < 1);
    assert.ok(Math.abs(dims.canvas.height - dims.parent.height) < 1);
    await shot(`boss-resize-${size.width}`);
  }
  if (local)
    await page.evaluate(() =>
      window.__claudeGame.game.scene.resume("CombatScene"),
    );
  await page.locator("#leave-combat").click();
  await page.getByRole("heading", { name: "안전하게 귀환" }).waitFor();
  checks.push("boss resize and escape");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/${process.env.GAME_URL ? "live-" : ""}results.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log({ checks, errors });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
