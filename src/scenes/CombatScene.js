import Phaser from "phaser";
import { store } from "../state/globalStore.js";
import { beginCombat, finishCombat } from "../systems/combatLifecycle.js";
import { createArena, stepArena } from "../systems/arena.js";
import {
  tickCombat,
  addReward,
  COMBAT_DURATION_MS,
} from "../systems/survivalCombat.js";
import { computeCombatStats } from "../systems/effectiveStats.js";
import { rollItem } from "../systems/items.js";
import { saveState } from "../state/persistence.js";
import { prepareArt, drawRoom, floatingText } from "./art.js";
import { sound } from "../audio.js";

export class CombatScene extends Phaser.Scene {
  constructor() {
    super("CombatScene");
  }
  create(data = {}) {
    this.ending = false;
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
    this.seal = this.add.graphics().setDepth(-8);
    this.drawSeal();
    this.hud = document.createElement("div");
    this.hud.className = "combat-hud";
    this.hud.innerHTML =
      '<div class="combat-top"><div><span class="eyebrow">SURVIVAL</span><strong id="combat-time">03:00</strong></div><button id="leave-combat" class="secondary">나가기 ↗</button></div><div class="health-line"><span>HP <b id="combat-hp">100</b></span><span id="combat-kills">0 처치</span></div><div class="health-track"><div id="combat-health-bar"></div></div><div class="combat-help">드래그 / 방향키로 이동 · 공격은 자동</div>';
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
      this.arena.player.x *= this.scale.width / this.arena.width;
      this.arena.player.y *= this.scale.height / this.arena.height;
      this.arena.width = this.scale.width;
      this.arena.height = this.scale.height;
      this.room.destroy();
      this.room = drawRoom(this, this.scale.width, this.scale.height, true);
      this.drawSeal();
    };
    this.scale.on("resize", this.resizeHandler);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.resizeHandler);
      this.hud.remove();
      document.getElementById("app").classList.remove("in-combat");
    });
    store.notify();
  }
  update(time, delta) {
    if (this.ending || document.hidden) return;
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
    for (const event of stepArena(this.arena, dt, this.stats, { x, y })) {
      if (event.type === "kill") {
        this.session.kills++;
        addReward(this.session, {
          gold: 4,
          exp: 5,
          ...(Math.random() < 0.25 ? { item: rollItem() } : {}),
        });
        floatingText(this, event.x, event.y, "+4G", "#e8cb82");
        sound("reward");
        saveState(store.getState());
      } else if (event.type === "hit")
        floatingText(
          this,
          event.x,
          event.y - 16,
          String(Math.round(event.damage)),
          "#ffe6c1",
        );
      else if (event.type === "hurt") {
        sound("hurt");
        this.cameras.main.shake(80, 0.003);
      } else if (event.type === "warning") {
        this.warning = event.message;
        this.warningUntil = time + 2000;
      }
    }
    const player = this.arena.player;
    this.player.setPosition(
      player.x,
      player.y + (x || y ? Math.sin(time / 100) * 2 : 0),
    );
    if (x) this.player.setFlipX(x < 0);
    this.player.setAlpha(
      this.arena.invulnerable > 0 ? (Math.sin(time / 50) > 0 ? 0.55 : 1) : 1,
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
    this.seal.strokeCircle(w / 2, h * 0.42, 95);
    this.seal.strokeCircle(w / 2, h * 0.42, 85);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        b = a + (Math.PI * 2) / 3;
      this.seal.lineBetween(
        w / 2 + 80 * Math.cos(a),
        h * 0.42 + 80 * Math.sin(a),
        w / 2 + 80 * Math.cos(b),
        h * 0.42 + 80 * Math.sin(b),
      );
    }
    this.seal.lineStyle(6, 0x563c52);
    this.seal.strokeRect(12, 142, w - 24, h - 170);
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
        g.fillCircle(e.x, e.y, 100);
        g.lineStyle(1, 0xb86fda, 0.5);
        g.strokeCircle(e.x, e.y, 100);
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
        g.lineBetween(h.x, h.y, h.tx, h.ty);
        g.strokeCircle(h.tx, h.ty, 20);
      } else {
        g.fillCircle(h.x, h.y, h.type === "nova" ? 60 : h.radius);
        g.strokeCircle(h.x, h.y, h.type === "nova" ? 60 : h.radius);
      }
    }
    g.fillStyle(0xed869c);
    for (const s of a.enemyShots) {
      g.fillCircle(s.x, s.y, 5);
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
    }
  }
  syncSprites(models, sprites, create) {
    const ids = new Set(models.map((e) => e.id));
    for (const [id, sprite] of sprites)
      if (!ids.has(id)) {
        sprite.destroy();
        sprites.delete(id);
      }
    for (const model of models) {
      if (!sprites.has(model.id)) sprites.set(model.id, create(model));
      sprites.get(model.id).setPosition(model.x, model.y);
    }
  }
  endCombat(outcome) {
    if (this.ending) return;
    this.ending = true;
    const state = store.getState();
    finishCombat(state, outcome);
    saveState(state);
    document.getElementById("app").classList.remove("in-combat");
    this.scale.setParentSize(
      this.scale.parent.clientWidth,
      this.scale.parent.clientHeight,
    );
    this.scene.start("IdleScene");
    store.notify();
  }
}
