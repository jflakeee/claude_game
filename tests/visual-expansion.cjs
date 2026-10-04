const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || "C:/Users/a/node_modules/playwright-core",
);
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const out = "docs/qa/2026-10-04";
fs.mkdirSync(out, { recursive: true });
const item = (id, grade = "normal", slot = "weapon") => ({
  id,
  name: `${grade} 시험 ${slot}`,
  grade,
  slot,
  identified: true,
  sockets: [],
  socketCount: 2,
  statBonus: { atk: 4, def: 3 },
});
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [],
    checks = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fixture = {
    character: {
      level: 10,
      exp: 0,
      stats: { atk: 20, def: 12, crit: 0.05 },
      skills: {},
      skillPoints: 30,
      equippedItems: [],
    },
    currency: { gold: 5000 },
    inventory: [
      item("forge", "magic"),
      { ...item("sealed", "rare", "armor"), identified: false },
      ...["a", "b", "c", "salvage", "sale"].map((id) => item(id)),
    ],
    scrapbook: [],
    materials: { ember: 6, frost: 6, ward: 6, dust: 12 },
    settings: { autoProgress: false, sound: false, notifications: true },
    progression: { kills: 0, bossWins: 0 },
  };
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("expansion-seeded")) {
      localStorage.setItem("claude_game_save_v1", JSON.stringify(s));
      sessionStorage.setItem("expansion-seeded", "1");
    }
  }, fixture);
  await page.goto("http://127.0.0.1:5173/claude_game/", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() =>
    window.__claudeGame?.game.scene.isActive("IdleScene"),
  );
  const state = () =>
    page.evaluate(() =>
      JSON.parse(JSON.stringify(window.__claudeGame.store.getState())),
    );
  const act = async (action) => {
    await page.locator(`[data-action="${action}"]`).click();
    await page.waitForTimeout(120);
  };
  const shot = async (name) => {
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  const select = async (field, value) => {
    await page.locator(`[data-field="${field}"]`).selectOption(value);
  };
  await page.locator('[data-view="craft"]').click();
  await select("craft-item", "sealed");
  await act("identify");
  assert.equal(
    (await state()).inventory.find((i) => i.id === "sealed").identified,
    true,
  );
  checks.push("identify");
  await select("craft-item", "forge");
  await select("rune", "ember");
  await act("socket");
  await act("socket");
  assert.equal(
    (await state()).inventory.find((i) => i.id === "forge").runeword,
    "cinder",
  );
  await shot("01-runeword");
  checks.push("ordered runeword");
  await act("reroll");
  assert.equal(
    (await state()).inventory.find((i) => i.id === "forge").sockets.length,
    2,
  );
  checks.push("reroll preserves sockets");
  await select("craft-item", "salvage");
  await act("salvage");
  assert.ok(!(await state()).inventory.some((i) => i.id === "salvage"));
  await select("cube-grade", "normal");
  await act("cube");
  assert.equal(
    (await state()).inventory.filter((i) => ["a", "b", "c"].includes(i.id))
      .length,
    0,
  );
  checks.push("salvage and cube");
  await select("transmute-rune", "frost");
  await act("transmute");
  assert.equal((await state()).materials.frost, 3);
  checks.push("rune conversion");
  await shot("02-cube");
  await page.locator('[data-view="gear"]').click();
  await page
    .locator('[data-action="equip-item"][data-item-id="forge"]')
    .click();
  await page.waitForTimeout(100);
  await page
    .locator('[data-action="equip-item"][data-item-id="sealed"]')
    .click();
  await page.waitForTimeout(100);
  await shot("03-equipment");
  await page.getByRole("tab", { name: "스킬" }).click();
  for (const id of [
    "power_strike",
    "power_strike",
    "power_strike",
    "iron_skin",
    "iron_skin",
    "iron_skin",
    "piercing",
    "chill",
    "frailty",
    "fury",
    "renewal",
    "vampirism",
  ]) {
    await page.locator(`[data-skill-id="${id}"]`).click();
    await page.waitForTimeout(100);
  }
  await page
    .locator('[data-action="select-skill"][data-item-id="fury"]')
    .click();
  await page.waitForTimeout(100);
  await page
    .locator('[data-action="select-skill"][data-item-id="chill"]')
    .click();
  await page.waitForTimeout(100);
  assert.equal((await state()).character.activeAura, "fury");
  assert.equal((await state()).character.activeCurse, "chill");
  checks.push("skill prerequisites synergy aura curse selection");
  await shot("04-skill-tree");
  await page.getByRole("tab", { name: "상점" }).click();
  await page.locator('[data-view="merchant"]').click();
  await select("sell-item", "sale");
  await act("sell");
  await page.locator('[data-action="buyback"]').click();
  await page.waitForTimeout(100);
  assert.ok((await state()).inventory.some((i) => i.id === "sale"));
  checks.push("sell buyback");
  await page.locator('[data-action="buy-rune"][data-item-id="ward"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-action="buy-stock"]').first().click();
  await page.waitForTimeout(100);
  await shot("05-merchant");
  await page.locator('[data-view="auction"]').click();
  await page.locator('[data-action="bid"]').first().click();
  await page.waitForTimeout(100);
  await page.locator('[data-action="buyout"]').first().click();
  await page.waitForTimeout(100);
  await page.locator('[data-action="claim"]').first().click();
  await page.waitForTimeout(100);
  checks.push("bid buyout claim");
  await select("auction-item", "sale");
  await select("auction-price", "1");
  await act("list-auction");
  const listed = (await state()).market.auctions.find(
    (a) => a.seller === "player",
  );
  assert.ok(listed);
  await shot("06-auction");
  // Observe real NPC competition with a known low bid; state fixture only sets the NPC willingness.
  await page.evaluate(() => {
    const s = window.__claudeGame.store.getState(),
      a = s.market.auctions.find((a) => a.seller === "npc");
    a.npcLimit = a.buyout - 5;
    a.nextNpcAt = Date.now() + 2500;
  });
  await page.locator('[data-action="bid"]').first().click();
  await page.evaluate(() => {
    window.__claudeGame.store
      .getState()
      .market.auctions.find((a) => a.seller === "npc").nextNpcAt =
      Date.now() + 2500;
  });
  await page.waitForFunction(
    () =>
      window.__claudeGame.store
        .getState()
        .market.auctions.find((a) => a.seller === "npc")?.highest === "npc",
    {},
    { timeout: 10000 },
  );
  checks.push("NPC rival bid and refund");
  await shot("07-outbid");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal((await state()).character.activeAura, "fury");
  assert.equal(
    (await state()).character.equippedItems.find((i) => i.id === "forge")
      .runeword,
    "cinder",
  );
  checks.push("expanded save migration restore");
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    await page.locator('[data-view="craft"]').click();
    await page.waitForTimeout(100);
    await shot(`08-craft-${size.width}`);
    await page.locator('[data-view="gear"]').click();
  }
  await page.locator(".boss-gate").click();
  await page.locator("#boss-name").waitFor();
  const patterns = new Set(),
    start = Date.now();
  let phaseTwo = false;
  const touch = await context.newCDPSession(page),
    anchor = { x: 195, y: 740 };
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [anchor],
  });
  while (Date.now() - start < 600000) {
    const live = await page.evaluate(() => {
      const c = window.__claudeGame.game.scene.getScene("CombatScene");
      return {
        active: c.scene.isActive(),
        p: c.arena.player,
        t: c.arena.elapsed,
        hazards: c.arena.hazards,
        boss: c.arena.enemies.find((e) => e.boss),
        result: window.__claudeGame.store.getState().lastResult,
      };
    });
    if (!live.active) {
      assert.equal(live.result.outcome, "cleared");
      checks.push("real time boss victory");
      break;
    }
    for (const h of live.hazards) {
      if (!patterns.has(h.type)) {
        patterns.add(h.type);
        await shot(`09-boss-${h.type}`);
        console.log("boss pattern", h.type);
      }
    }
    if (live.boss?.phase === 2 && !phaseTwo) {
      phaseTwo = true;
      await shot("10-boss-phase-two");
    }
    const angle = live.t * 0.45,
      tx = Math.max(25,Math.min(365,(live.boss?.x??195) + 105 * Math.cos(angle))),
      ty = Math.max(200,Math.min(780,(live.boss?.y??440) + 105 * Math.sin(angle)));
    let dx = (tx - live.p.x) / 18,
      dy = (ty - live.p.y) / 18;
    const len = Math.max(1, Math.hypot(dx, dy));
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: anchor.x + (dx / len) * 38, y: anchor.y + (dy / len) * 38 },
      ],
    });
    await page.waitForTimeout(130);
  }
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page
    .getByRole("heading", { name: "보스 격파!" })
    .waitFor({ timeout: 1000 });
  await shot("11-boss-victory");
  assert.equal((await state()).progression.bossWins, 1);
  checks.push("boss loot and progression");
  await page.getByRole("button", { name: "탐험 계속" }).click();
  await page.getByRole("tab", { name: "상점" }).click();
  await page.locator('[data-view="auction"]').click();
  await page.waitForTimeout(200);
  await shot("12-market-after-boss");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      { checks, patterns: [...patterns], phaseTwo, errors },
      null,
      2,
    ),
  );
  console.log({ checks, patterns: [...patterns], phaseTwo, errors });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
