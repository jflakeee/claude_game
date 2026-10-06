import Phaser from "phaser";
import { motionEnabled, advanceHealthTrail, deathEcho, rewardFlight } from "../systems/presentation.js";
import { store } from "../state/globalStore.js";
import { beginCombat, finishCombat } from "../systems/combatLifecycle.js";
import { createArena, stepArena, resizeArena } from "../systems/arena.js";
import {
  tickCombat,
  addReward,
  COMBAT_DURATION_MS,
} from "../systems/survivalCombat.js";
import { computeCombatStats } from "../systems/effectiveStats.js";
import { rollItem } from "../systems/items.js";
import { saveState } from "../state/persistence.js";
import { prepareArt, drawRoom, floatingText, poseActor } from "./art.js";
import { sound } from "../audio.js";
import { arenaBounds, bossLayout } from "../systems/arenaLayout.js";
import { HAZARD_GEOMETRY } from "../systems/hazardRules.js";

export class CombatScene extends Phaser.Scene {
  constructor() {
    super("CombatScene");
  }
  create(data = {}) {
    this.ending = false;
    this.completeExit = null;
    this.introUntil = 0;
    this.strikeUntil = 0;
    this.hurtUntil = 0;
    this.hitEffects = new Map();
    this.healthTrail = { hp: 100, trail: 100, hold: 0 };
    prepareArt(this);
    document.getElementById("app").classList.add("in-combat");
    this.scale.setParentSize(
      this.scale.parent.clientWidth,
      this.scale.parent.clientHeight,
    );
    const state = store.getState();
    this.encounter = data.encounter || "survival";
    this.session = beginCombat(state, this.encounter);
    saveState(state);
    this.arena = createArena(this.scale.width, this.scale.height, {
      encounter: this.encounter,
      bossWins: state.progression.bossWins,
    });
    this.stats = computeCombatStats(state.character);
    this.room = drawRoom(this, this.scale.width, this.scale.height, true);
    this.player = this.add
      .sprite(this.arena.player.x, this.arena.player.y, "hero")
      .setScale(3)
      .setDepth(4);
    this.enemySprites = new Map();
    this.boltSprites = new Map();
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.drag = null;
    this.input.on("pointerdown", (p) => {
      this.drag = { x: p.x, y: p.y };
    });
    this.input.on("pointerup", () => {
      this.drag = null;
    });
    this.input.on("gameout", () => {
      this.drag = null;
    });
    this.joystick = this.add.graphics().setDepth(15);
    this.effects = this.add.graphics().setDepth(2);
    this.debugHitboxes = false;
    if (import.meta.env.DEV) {
      this.debugGraphics = this.add.graphics().setDepth(20);
      this.debugLabel = this.add.text(10, 72, '', { fontFamily: 'system-ui', fontSize: '10px', color: '#fff', backgroundColor: '#10202acc', padding: { x: 5, y: 3 } }).setDepth(21).setVisible(false);
      this.input.keyboard?.on('keydown-F2', () => { this.debugHitboxes = !this.debugHitboxes; this.debugGraphics.setVisible(this.debugHitboxes); this.debugLabel.setVisible(this.debugHitboxes); });
    }
    this.seal = this.add.graphics().setDepth(-8);
    this.drawSeal();
    this.hud = document.createElement("div");
    this.hud.className = "combat-hud";
    this.hud.innerHTML =
      '<div class="combat-top"><div><span class="eyebrow">SURVIVAL</span><strong id="combat-time">03:00</strong></div><button id="leave-combat" class="secondary">나가기 ↗</button></div><div class="health-line"><span>HP <b id="combat-hp">100</b></span><span id="combat-kills">0 처치</span></div><div class="health-track"><div id="combat-health-trail"></div><div id="combat-health-bar"></div></div><div class="combat-help">드래그 / 방향키로 이동 · 공격은 자동</div>';
    document.getElementById("game-container").append(this.hud);
    this.hud.insertAdjacentHTML(
      "beforeend",
      '<div class="combat-effects" role="status"></div>',
    );
    if (this.encounter === "boss") {
      this.hud.classList.add("boss-mode");
      this.hud.querySelector(".eyebrow").textContent = "BOSS ARENA";
      this.hud
        .querySelector(".health-track")
        .insertAdjacentHTML(
          "afterend",
          '<div class="boss-panel"><div><b id="boss-name"></b><span id="boss-phase"></span></div><div class="boss-track"><span id="boss-health"></span></div></div>',
        );
    }
    this.hud
      .querySelector("button")
      .addEventListener("click", () => this.endCombat("escaped"));
    this.resizeHandler = () => {
      resizeArena(this.arena, this.scale.width, this.scale.height);
      this.drag = null;
      this.room.destroy();
      this.room = drawRoom(this, this.scale.width, this.scale.height, true);
      this.drawSeal();
    };
    this.scale.on("resize", this.resizeHandler);
    if (this.encounter === 'boss' && motionEnabled()) {
      this.introUntil = this.game.loop.time + 900;
      this.intro = document.createElement('div');
      this.intro.className = 'boss-introduction';
      this.intro.innerHTML = '<span class="eyebrow">회랑의 수호자</span><strong>다가오는 위협을 살피세요</strong><button class="secondary">바로 시작 →</button>';
      this.hud.append(this.intro);
      this.intro.querySelector('button').addEventListener('click', () => { this.introUntil = 0; });
      this.cameras.main.fadeIn(450, 13, 23, 30);
    }
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.resizeHandler);
      this.hud.remove();
      document.getElementById("app").classList.remove("in-combat", "result-pending");
    });
    store.notify();
  }
  update(time, delta) {
    if (this.ending || document.hidden) return;
    if (time < this.introUntil && motionEnabled()) {
      this.syncSprites(this.arena.enemies, this.enemySprites, e => this.add.sprite(e.x, e.y, e.boss ? 'guardian' : ['slime', 'bat', 'skull'][e.kind]).setScale(e.boss ? 4.5 : 2.6).setDepth(3));
      this.drawEffects(time);
      return;
    }
    if (this.intro) {
      this.intro.remove(); this.intro = null;
      this.cameras.main.resetFX();
      this.drag = null;
    }
    const dt = Math.min(delta, 50),
      p = this.input.activePointer;
    let x = 0,
      y = 0;
    if (this.cursors) {
      x = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
      y = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
    }
    this.joystick.clear();
    if (this.drag && p.isDown) {
      x = (p.x - this.drag.x) / 38;
      y = (p.y - this.drag.y) / 38;
      this.joystick.lineStyle(2, 0xe8cc9c, 0.35);
      this.joystick.strokeCircle(this.drag.x, this.drag.y, 38);
      const len = Math.max(1, Math.hypot(x, y));
      this.joystick.fillStyle(0xe8cc9c, 0.35);
      this.joystick.fillCircle(
        this.drag.x + (x / len) * 28,
        this.drag.y + (y / len) * 28,
        12,
      );
    }
    const attackBefore = this.arena.attack;
    const events = stepArena(this.arena, dt, this.stats, { x, y });
    if (this.arena.attack > attackBefore) this.strikeUntil = time + 130;
    for (const event of events) {
      if (event.type === "kill") {
        this.session.kills++;
        addReward(this.session, {
          gold: 4,
          exp: 5,
          ...(Math.random() < 0.25 ? { item: rollItem() } : {}),
        });
        floatingText(this, event.x, event.y, "+4G", "#e8cb82");
        rewardFlight(this, event.x, event.y, "#combat-kills");
        sound("reward");
        saveState(store.getState());
      } else if (event.type === "hit") {
        this.hitEffects.set(event.targetId, { until: time + 120, ...event });
        floatingText(
          this,
          event.x,
          event.y - 16,
          String(Math.round(event.damage)),
          "#ffe6c1",
        );
      } else if (event.type === "hurt") {
        this.hurtUntil = time + 160;
        sound("hurt");
        if (motionEnabled()) this.cameras.main.shake(80, 0.003);
      } else if (event.type === "warning") {
        const priority = event.priority || 1;
        if (priority > (this.warningPriority || 0) || time >= (this.warningUntil || 0)) {
          this.warning = event.message;
          this.warningPriority = priority;
        } else if (priority === this.warningPriority && !this.warning.includes(event.message)) {
          this.warning = `${this.warning} · ${event.message}`.slice(0, 100);
        }
        this.warningUntil = Math.max(this.warningUntil || 0, time + 2000);
      }
    }
    const player = this.arena.player;
    this.player.setPosition(
      player.x,
      player.y + (motionEnabled() && (x || y) ? Math.sin(time / 100) * 2 : 0),
    );
    if (x) this.player.setFlipX(x < 0);
    poseActor(this.player, 'hero', time, { moving: !!(x || y), strike: time < this.strikeUntil,
      hurt: time < this.hurtUntil, ready: this.arena.enemies.length > 0 && this.arena.attack > 0 && this.arena.attack < 0.1 });
    this.player.setAlpha(
      this.arena.invulnerable > 0 ? 0.65 : 1,
    );
    this.syncSprites(this.arena.enemies, this.enemySprites, (e) =>
      this.add
        .sprite(
          e.x,
          e.y,
          e.boss ? "guardian" : ["slime", "bat", "skull"][e.kind],
        )
        .setScale(e.boss ? 4.5 : e.leader ? 3.2 : 2.6)
        .setTint(e.leader ? 0xd595f4 : 0xffffff)
        .setDepth(3),
    );
    this.syncSprites(this.arena.bolts, this.boltSprites, (b) =>
      this.add.star(b.x, b.y, 4, 3, 8, 0xffdc93).setDepth(5),
    );
    for (const e of this.arena.enemies) {
      if (!e.boss && e.kind === 0) poseActor(this.enemySprites.get(e.id), 'slime', time,
        { moving: true, hurt: this.hitEffects.has(e.id) });
      else if (!e.boss && e.kind === 1) poseActor(this.enemySprites.get(e.id), 'bat', time, { moving: true });
      else if (!e.boss) poseActor(this.enemySprites.get(e.id), 'skull', time, { moving: true });
      else poseActor(this.enemySprites.get(e.id), 'guardian', time, { ready: true, strike: !!e.dash });
    }
    for (const [id, fx] of this.hitEffects) {
      const sprite = this.enemySprites.get(id);
      const model = this.arena.enemies.find(e => e.id === id);
      if (!sprite || time >= fx.until) {
        if (sprite) sprite.setTint(model?.leader ? 0xd595f4 : 0xffffff);
        this.hitEffects.delete(id);
        continue;
      }
      const remaining = fx.until - time;
      if (remaining > 55) sprite.setTintFill(0xffedba);
      else sprite.setTint(model?.leader ? 0xd595f4 : 0xffffff);
      if (motionEnabled()) sprite.setPosition(model.x + fx.direction.x * 4 * remaining / 120,
        model.y + fx.direction.y * 4 * remaining / 120);
    }
    this.session.hp = player.hp;
    tickCombat(this.session, dt, player.hp);
    if (this.encounter === "boss") {
      if (this.arena.bossDefeated) this.session.outcome = "cleared";
      else if (this.session.outcome === "cleared")
        this.session.outcome = "failed";
    }
    this.drawEffects(time);
    store.getState().runState.combatTimer = this.session.elapsedMs;
    const seconds = Math.max(
      0,
      Math.ceil((COMBAT_DURATION_MS - this.session.elapsedMs) / 1000),
    );
    this.hud.querySelector("#combat-time").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    this.hud.querySelector("#combat-hp").textContent = Math.ceil(player.hp);
    this.hud.querySelector("#combat-health-bar").style.width = `${player.hp}%`;
    const trail = advanceHealthTrail(this.healthTrail, player.hp, dt);
    this.hud.querySelector("#combat-health-trail").style.width = `${motionEnabled() ? trail : player.hp}%`;
    this.hud.querySelector("#combat-kills").textContent =
      `${this.session.kills} 처치 · ${this.session.rewards.gold}G`;
    if (this.session.outcome) this.endCombat(this.session.outcome);
  }
  drawSeal() {
    this.seal.clear();
    if (this.encounter !== "boss") return;
    const w = this.scale.width,
      h = this.scale.height;
    this.seal.lineStyle(3, 0x70485f, 0.7);
    const { x, y, radius } = bossLayout(w, h),
      bounds = arenaBounds(w, h, "boss");
    this.seal.strokeCircle(x, y, radius);
    this.seal.strokeCircle(x, y, radius * 0.89);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        b = a + (Math.PI * 2) / 3;
      this.seal.lineBetween(
        x + radius * 0.84 * Math.cos(a),
        y + radius * 0.84 * Math.sin(a),
        x + radius * 0.84 * Math.cos(b),
        y + radius * 0.84 * Math.sin(b),
      );
    }
    this.seal.lineStyle(6, 0x563c52);
    this.seal.strokeRect(
      12,
      bounds.top - 20,
      w - 24,
      bounds.bottom - bounds.top + 40,
    );
  }
  drawEffects(time) {
    const g = this.effects,
      a = this.arena,
      p = a.player;
    g.clear();
    if (this.stats.aura) {
      g.lineStyle(2, this.stats.aura === "fury" ? 0xe5b46f : 0x77d3b3, 0.35);
      g.strokeCircle(p.x, p.y, 130);
    }
    for (const e of a.enemies) {
      if (e.leader) {
        g.fillStyle(0xb86fda, 0.09);
        g.fillCircle(e.x, e.y, HAZARD_GEOMETRY.leaderAuraRadius);
        g.lineStyle(1, 0xb86fda, 0.5);
        g.strokeCircle(e.x, e.y, HAZARD_GEOMETRY.leaderAuraRadius);
        // Four inward marks distinguish a hostile field from a player aura.
        for (let i = 0; i < 4; i++) {
          const angle = i * Math.PI / 2;
          const cx = e.x + Math.cos(angle) * (HAZARD_GEOMETRY.leaderAuraRadius - 6), cy = e.y + Math.sin(angle) * (HAZARD_GEOMETRY.leaderAuraRadius - 6);
          g.lineStyle(2, 0xd6a5ed, 0.8);
          g.lineBetween(cx - Math.cos(angle - 0.55) * 10, cy - Math.sin(angle - 0.55) * 10, cx, cy);
          g.lineBetween(cx - Math.cos(angle + 0.55) * 10, cy - Math.sin(angle + 0.55) * 10, cx, cy);
        }
      }
      if (e.curseTimer > 0) {
        g.lineStyle(2, e.curse === "chill" ? 0x8dd9f1 : 0xeb97bb, 0.8);
        g.strokeCircle(e.x, e.y, e.boss ? 35 : 21);
      }
    }
    for (const h of a.hazards) {
      const color = h.active ? 0xf06c83 : 0xf2c979;
      g.lineStyle(h.type === "charge" ? 10 : 3, color, h.active ? 0.8 : 0.65);
      g.fillStyle(color, h.active ? 0.32 : 0.14);
      if (h.type === "charge") {
        // Filled corridor visualizes the existing center-distance threshold.
        g.lineStyle(HAZARD_GEOMETRY.chargeHalfWidth * 2, color, h.active ? 0.22 : 0.1);
        g.lineBetween(h.x, h.y, h.tx, h.ty);
        g.lineStyle(2, color, 0.85);
        g.lineBetween(h.x, h.y, h.tx, h.ty);
        const angle = Math.atan2(h.ty - h.y, h.tx - h.x);
        for (const t of [0.35, 0.65, 0.9]) {
          const x = h.x + (h.tx - h.x) * t, y = h.y + (h.ty - h.y) * t;
          g.lineBetween(x, y, x - Math.cos(angle - 0.6) * 12, y - Math.sin(angle - 0.6) * 12);
          g.lineBetween(x, y, x - Math.cos(angle + 0.6) * 12, y - Math.sin(angle + 0.6) * 12);
        }
        g.strokeCircle(h.tx, h.ty, 22);
      } else if (h.type === 'nova') {
        // A burst source, not a filled circular damage area.
        g.strokeCircle(h.x, h.y, 28);
        for (let i = 0; i < 10; i++) {
          const angle = i * Math.PI / 5;
          g.lineBetween(h.x + Math.cos(angle) * 36, h.y + Math.sin(angle) * 36,
            h.x + Math.cos(angle) * 60, h.y + Math.sin(angle) * 60);
        }
      } else {
        g.fillCircle(h.x, h.y, h.type === "nova" ? 60 : h.radius);
        g.strokeCircle(h.x, h.y, h.radius);
      }
    }
    g.fillStyle(0xed869c);
    for (const s of a.enemyShots) {
      g.fillCircle(s.x, s.y, 5);
    }
    if (this.debugGraphics) {
      const d = this.debugGraphics;
      d.clear();
      this.debugLabel.setText('F2 끄기 · 플레이어 접촉 반경 / 공격 판정');
      if (this.debugHitboxes) {
        d.lineStyle(2, 0x65f3e1, 0.9);
        d.strokeCircle(p.x, p.y, HAZARD_GEOMETRY.playerContactRadius);
        for (const e of a.enemies) d.strokeCircle(e.x, e.y, e.boss ? HAZARD_GEOMETRY.bossShotTargetRadius : HAZARD_GEOMETRY.enemyShotTargetRadius);
        for (const h of a.hazards) {
          d.lineStyle(2, 0xfff36a, 1);
          if (h.type === 'blast') d.strokeCircle(h.x, h.y, HAZARD_GEOMETRY.blastRadius);
          if (h.type === 'charge') {
            d.lineStyle(HAZARD_GEOMETRY.chargeHalfWidth * 2, 0xfff36a, 0.8);
            d.lineBetween(h.x, h.y, h.tx, h.ty);
          }
        }
        for (const s of a.enemyShots) d.strokeCircle(s.x, s.y, HAZARD_GEOMETRY.enemyShotRadius);
      }
    }
    const labels = [];
    if (a.playerHex > 0) labels.push("쇠약 · 방어/이동 감소");
    if (this.stats.aura)
      labels.push(this.stats.aura === "fury" ? "분노 오라" : "회복 오라");
    if (this.stats.curse)
      labels.push(this.stats.curse === "chill" ? "한기 저주" : "분쇄 저주");
    this.hud.querySelector(".combat-effects").textContent =
      time < this.warningUntil ? this.warning : labels.join(" · ");
    const boss = a.enemies.find((e) => e.boss);
    if (boss && this.encounter === "boss") {
      this.hud.querySelector("#boss-name").textContent = boss.name;
      this.hud.querySelector("#boss-phase").textContent =
        `${boss.phase}단계 · ${Math.ceil(boss.hp)}/${boss.maxHp}`;
      this.hud.querySelector("#boss-health").style.width =
        `${(boss.hp / boss.maxHp) * 100}%`;
    } else if (this.encounter === "boss" && a.bossDefeated) {
      this.hud.querySelector("#boss-phase").textContent = "격파 완료";
      this.hud.querySelector("#boss-health").style.width = "0%";
    }
  }
  syncSprites(models, sprites, create) {
    const ids = new Set(models.map((e) => e.id));
    for (const [id, sprite] of sprites)
      if (!ids.has(id)) {
        if (sprites === this.enemySprites) deathEcho(this, sprite);
        sprite.destroy();
        sprites.delete(id);
      }
    for (const model of models) {
      if (!sprites.has(model.id)) sprites.set(model.id, create(model));
      sprites.get(model.id).setPosition(model.x, model.y);
    }
  }
  endCombat(outcome) {
    if (this.ending) {
      this.completeExit?.();
      return;
    }
    this.ending = true;
    const state = store.getState();
    finishCombat(state, outcome);
    saveState(state);
    let exited = false;
    this.completeExit = () => {
      if (exited) return;
      exited = true;
      document.getElementById("app").classList.remove("in-combat", "result-pending");
      this.scale.setParentSize(this.scale.parent.clientWidth, this.scale.parent.clientHeight);
      this.scene.start("IdleScene");
      store.notify();
    };
    if (outcome === "cleared" && motionEnabled()) {
      document.getElementById("app").classList.add("result-pending");
      this.hud.querySelector(".combat-effects").textContent =
        this.encounter === "boss" ? "보스 격파 · 보상을 정리합니다" : "생존 성공 · 보상을 정리합니다";
      this.hud.querySelector("button").textContent = "결과 보기 ↗";
      this.time.delayedCall(420, this.completeExit);
    } else this.completeExit();
  }
}
