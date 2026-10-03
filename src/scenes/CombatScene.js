import Phaser from "phaser";
import { store } from "../state/globalStore.js";
import { beginCombat, finishCombat } from "../systems/combatLifecycle.js";
import { createArena, stepArena } from "../systems/arena.js";
import {
  tickCombat,
  addReward,
  COMBAT_DURATION_MS,
} from "../systems/survivalCombat.js";
import { computeEffectiveStats } from "../systems/effectiveStats.js";
import { rollItem } from "../systems/items.js";
import { saveState } from "../state/persistence.js";
import { prepareArt, drawRoom, floatingText } from "./art.js";
import { sound } from "../audio.js";

export class CombatScene extends Phaser.Scene {
  constructor() {
    super("CombatScene");
  }
  create() {
    this.ending = false;
    prepareArt(this);
    document.getElementById("app").classList.add("in-combat");
    this.scale.setParentSize(
      this.scale.parent.clientWidth,
      this.scale.parent.clientHeight,
    );
    const state = store.getState();
    this.session = beginCombat(state);
    saveState(state);
    this.arena = createArena(this.scale.width, this.scale.height);
    this.stats = {
      ...computeEffectiveStats(state.character),
      crit: state.character.stats.crit,
    };
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
    this.hud = document.createElement("div");
    this.hud.className = "combat-hud";
    this.hud.innerHTML =
      '<div class="combat-top"><div><span class="eyebrow">SURVIVAL</span><strong id="combat-time">03:00</strong></div><button id="leave-combat" class="secondary">나가기 ↗</button></div><div class="health-line"><span>HP <b id="combat-hp">100</b></span><span id="combat-kills">0 처치</span></div><div class="health-track"><div id="combat-health-bar"></div></div><div class="combat-help">드래그 / 방향키로 이동 · 공격은 자동</div>';
    document.getElementById("game-container").append(this.hud);
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
        .sprite(e.x, e.y, ["slime", "bat", "skull"][e.kind])
        .setScale(2.6)
        .setDepth(3),
    );
    this.syncSprites(this.arena.bolts, this.boltSprites, (b) =>
      this.add.star(b.x, b.y, 4, 3, 8, 0xffdc93).setDepth(5),
    );
    this.session.hp = player.hp;
    tickCombat(this.session, dt, player.hp);
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
