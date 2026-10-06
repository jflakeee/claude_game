const { chromium } = require('C:/Users/a/node_modules/playwright-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = 'docs/qa/2026-10-05/motion';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5174/claude_game/', { waitUntil: 'networkidle' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      window.__claudeGame.store.getState().settings.motion = true;
      window.introHold = setInterval(() => {
        const s = window.__claudeGame.game.scene.getScene('CombatScene');
        if (s.intro) s.introUntil = s.time.now + 10000;
      }, 20);
    });
    await page.getByRole('button', { name: /보스 아레나/ }).click();
    await page.waitForSelector('.boss-introduction').catch(async e => {
      console.log(await page.evaluate(() => { const s = window.__claudeGame.game.scene.getScene('CombatScene'); return { encounter: s.encounter, introUntil: s.introUntil, now: s.time.now, intro: !!s.intro, motion: window.__claudeGame.store.getState().settings.motion, create: s.create.toString().includes('introUntil'), errors: document.querySelector('.combat-hud')?.innerHTML }; }));
      throw e;
    });
    await page.evaluate(() => { window.__claudeGame.game.scene.getScene('CombatScene').introUntil += 10000; });
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__claudeGame.game.scene.getScene('CombatScene').session.elapsedMs), 0);
    await page.screenshot({ path: out + '/01-introduction.png' });
    await page.evaluate(() => clearInterval(window.introHold));
    await page.getByRole('button', { name: /바로 시작/ }).click();
    await page.waitForFunction(() => window.__claudeGame.game.scene.getScene('CombatScene').session.elapsedMs > 0);
    await page.evaluate(() => {
      const s = window.__claudeGame.game.scene.getScene('CombatScene');
      s.scene.pause();
      s.debugHitboxes = true;
      s.debugGraphics.setVisible(true); s.debugLabel.setVisible(true);
      s.arena.hazards = [
        { type: 'charge', x: 55, y: 390, tx: 330, ty: 560, delay: 1, life: 1, active: false },
        { type: 'blast', x: 280, y: 390, radius: 48, delay: 1, life: 1, active: false },
      ];
      s.drawEffects(s.game.loop.time);
    });
    await page.screenshot({ path: out + '/03-hitboxes.png' });
    await page.evaluate(() => { const s = window.__claudeGame.game.scene.getScene('CombatScene'); s.scene.resume(); s.debugHitboxes = false; s.debugGraphics.setVisible(false); s.debugLabel.setVisible(false); });
    await page.keyboard.down('ArrowRight');
    const frames = new Set();
    for (let i = 0; i < 8; i++) {
      frames.add(await page.evaluate(() => window.__claudeGame.game.scene.getScene('CombatScene').player.texture.key));
      await page.waitForTimeout(65);
    }
    await page.keyboard.up('ArrowRight');
    assert.ok([...frames].some(f => f.startsWith('hero-step-')), [...frames].join(','));
    await page.evaluate(() => {
      const s = window.__claudeGame.game.scene.getScene('CombatScene');
      s.scene.pause();
      const sheet = document.createElement('div');
      sheet.id = 'pose-sheet';
      sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#172833;color:#eee;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:20px';
      for (const key of ['hero', 'hero-step-a', 'hero-step-b', 'hero-ready', 'hero-strike', 'hero-hurt', 'slime', 'slime-step', 'slime-hurt']) {
        const cell = document.createElement('div');
        cell.textContent = key;
        const c = document.createElement('canvas'); c.width = c.height = 80;
        const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(s.textures.get(key).getSourceImage(), 0, 0, 80, 80);
        cell.append(c); sheet.append(cell);
      }
      document.body.append(sheet);
    });
    await page.screenshot({ path: out + '/02-poses.png' });
    await page.evaluate(() => { document.querySelector('#pose-sheet').remove(); window.__claudeGame.game.scene.getScene('CombatScene').scene.resume(); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      const s = window.__claudeGame.game.scene.getScene('CombatScene');
      s.arena.player.hp = 100; s.arena.invulnerable = 5;
      s.hurtUntil = 0; s.strikeUntil = 0;
      for (const e of s.arena.enemies) { e.x = 30; e.y = 220; }
    });
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.__claudeGame.game.scene.getScene('CombatScene').player.texture.key), 'hero');
    await page.keyboard.up('ArrowLeft');
    await page.getByRole('button', { name: /나가기/ }).click();
    await page.getByRole('button', { name: '탐험 계속', exact: true }).click();
    await page.getByRole('button', { name: /보스 아레나/ }).click();
    await page.waitForSelector('.boss-panel');
    assert.equal(await page.locator('.boss-introduction').count(), 0);
    await page.evaluate(async () => {
      const s = window.__claudeGame.game.scene.getScene('CombatScene');
      const { rollItem } = await import('/claude_game/src/systems/items.js');
      s.session.rewards.items.push(rollItem(() => 0.5, { grade: 'epic', slot: 'weapon', identified: true }));
      s.endCombat('escaped');
    });
    await page.locator('#result-dialog[open]').waitFor();
    assert.equal(await page.locator('.result-item').count(), 1);
    assert.match(await page.locator('.result-item').innerText(), /공격 .* → .*방어/);
    await page.screenshot({ path: out + '/04-reward-comparison.png' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#result-dialog[open]').waitFor();
    assert.equal(await page.locator('.result-item').count(), 1);
    await page.getByRole('button', { name: '탐험 계속', exact: true }).click();
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/results.json', JSON.stringify({ passed: true, errors, frames: [...frames], checks: ['intro freezes timer', 'skip resumes combat', 'movement poses', 'reduced motion static pose', 'reduced motion skips intro', 'shared hazard geometry overlay', 'reward equipment comparison', 'result restored from save'] }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
