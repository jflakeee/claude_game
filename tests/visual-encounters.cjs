const { chromium } = require("C:/Users/a/node_modules/playwright-core");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "claude_game_save_v1",
      JSON.stringify({
        settings: { autoProgress: false, sound: false },
        character: {
          level: 10,
          stats: { atk: 1, def: 5, crit: 0 },
          skills: { chill: 1, fury: 1 },
          activeAura: "fury",
          activeCurse: "chill",
        },
      }),
    ),
  );
  await page.goto("http://127.0.0.1:5173/claude_game/", {
    waitUntil: "networkidle",
  });
  await page.locator(".boss-gate").click();
  await page.locator("#boss-name").waitFor();
  // Presentation fixtures choose each next pattern; actual frame timing/collision/rendering remain active.
  for (const [index, type] of ["blast", "nova", "charge"].entries()) {
    await page.evaluate(async (index) => {
      const c = window.__claudeGame.game.scene.getScene("CombatScene");
      c.scene.resume();
      c.arena.patternIndex = index;
      c.arena.patternTimer = 0;
      c.arena.player.hp = 100;
      c.arena.invulnerable = 0;
      c.arena.attack = 999;
      c.arena.spawn = 999;
      c.arena.packTimer = 999;
      c.arena.hazards = [];
      c.arena.enemyShots = [];
      c.arena.player.x = 195;
      c.arena.player.y = 600;
      const boss=c.arena.enemies.find(e=>e.boss);boss.x=195;boss.y=355;boss.dash=null;
      await new Promise(resolve=>{function frame(){if(c.arena.hazards.some(h=>h.type===["blast","nova","charge"][index])){c.scene.pause();resolve();}else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    }, index);
    await page.waitForFunction((type) => {
      const c = window.__claudeGame.game.scene.getScene("CombatScene");
      if (c.arena.hazards.some((h) => h.type === type)) {
        c.scene.pause();
        return true;
      }
      return false;
    }, type);
    await page.screenshot({ path: `docs/qa/2026-10-04/pattern-${type}.png` });
    await page.evaluate(async () => {
      const c=window.__claudeGame.game.scene.getScene('CombatScene');c.scene.resume();
      const end=c.arena.elapsed+1.4;
      await new Promise(resolve=>{function frame(){if(c.arena.elapsed>=end){c.scene.pause();resolve();}else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    });
    if (type === "blast")
      assert.ok(
        await page.evaluate(
          () =>
            window.__claudeGame.game.scene.getScene("CombatScene").arena.player
              .hp < 90,
        ),
        "standing inside blast takes damage",
      );
    await page.evaluate(() =>
      window.__claudeGame.game.scene.pause("CombatScene"),
    );
    await page.screenshot({ path: `docs/qa/2026-10-04/active-${type}.png` });
    console.log("verified pattern", type);
  }
  await page.evaluate(() => {
    const c = window.__claudeGame.game.scene.getScene("CombatScene");
    c.arena.player.hp = 100;
    c.arena.invulnerable = 10;
    c.arena.packTimer = 0;
    c.arena.enemies.find((e) => e.boss).hp = 150;
    c.scene.resume();
  });
  await page.waitForFunction(() => {
    const c = window.__claudeGame.game.scene.getScene("CombatScene"),
      e = c.arena.enemies.find((e) => e.leader);
    if (!e) return false;
    c.arena.player.x = Math.max(30, Math.min(360, e.x + 50));
    c.arena.player.y = e.y;
    return c.arena.playerHex > 0;
  });
  await page.evaluate(() =>
    window.__claudeGame.game.scene.pause("CombatScene"),
  );
  await page.screenshot({
    path: "docs/qa/2026-10-04/pack-curse-phase-two.png",
  });
  assert.ok(
    await page.evaluate(
      () =>
        window.__claudeGame.game.scene
          .getScene("CombatScene")
          .arena.enemies.find((e) => e.boss).phase === 2,
    ),
  );
  // Timer boundary fixture: a living boss must fail, never grant a victory.
  await page.evaluate(() => {
    const c = window.__claudeGame.game.scene.getScene("CombatScene");
    c.session.elapsedMs = 179990;
    c.scene.resume();
  });
  await page.getByRole("heading", { name: "다시 도전해요" }).waitFor();
  await page.screenshot({ path: "docs/qa/2026-10-04/boss-timeout.png" });
  assert.equal(
    await page.evaluate(
      () => window.__claudeGame.store.getState().progression.bossWins,
    ),
    0,
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "docs/qa/2026-10-04/encounters.json",
    JSON.stringify(
      {
        patterns: ["blast", "nova", "charge"],
        blastDamage: true,
        pack: true,
        phaseTwo: true,
        timeoutFailed: true,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  console.log("encounter visual checks passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
