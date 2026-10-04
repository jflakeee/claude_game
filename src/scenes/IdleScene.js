import Phaser from "phaser";
import { store } from "../state/globalStore.js";
import {
  advanceIdleProgress,
  resolveIdleKill,
  STAGE_LENGTH_PX,
} from "../systems/idleCombat.js";
import { applyLevelUps } from "../systems/leveling.js";
import { prepareArt, drawRoom, floatingText } from "./art.js";
import { sound } from "../audio.js";
import { awardMaterials } from "../systems/crafting.js";
import { computeCombatStats } from "../systems/effectiveStats.js";
import { strikeIdleEnemy, advanceIdleEnemy } from "../systems/idleEffects.js";
import { recordLoot } from "../systems/items.js";

export class IdleScene extends Phaser.Scene {
  constructor() {
    super("IdleScene");
  }
  create() {
    prepareArt(this);
    this.progress = store.getState().runState;
    this.tickAccumulator = 0;
    this.idleHp = 100;
    this.idleEnemy = { hp: 10 };
    this.redraw();
    this.bossGate = document.createElement("button");
    this.bossGate.className = "boss-gate";
    this.bossGate.textContent = "♜ 보스 아레나";
    document.getElementById("game-container").append(this.bossGate);
    this.bossGate.addEventListener("click", () =>
      this.scene.start("CombatScene", { encounter: "boss" }),
    );
    this.resizeHandler = () => this.redraw();
    this.scale.on("resize", this.resizeHandler);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.resizeHandler);
      this.bossGate.remove();
    });
    this.input.on("pointerup", () => {
      if (!document.querySelector("dialog[open]"))
        this.scene.start("CombatScene");
    });
  }
  redraw() {
    this.tweens.killAll();
    this.children.removeAll(true);
    const w = this.scale.width,
      h = this.scale.height;
    this.room = drawRoom(this, w + 112, h);
    this.shadow = this.add.ellipse(w / 2, h * 0.7 + 17, 40, 12, 0x07151b, 0.5);
    this.character = this.add
      .sprite(w / 2, h * 0.7, "hero")
      .setScale(3)
      .setDepth(3);
    this.enemy = this.add.sprite(w * 0.75, h * 0.7, "slime").setScale(3);
    this.effects = this.add.graphics().setDepth(2);
    this.effectsLabel = this.add.text(22, 95, "", {
      fontFamily: "system-ui",
      fontSize: "10px",
      color: "#c8b0df",
    });
    this.hpTrack = this.add.rectangle(0, 0, 38, 4, 0x11212a).setDepth(5);
    this.hpFill = this.add.rectangle(0, 0, 38, 4, 0x83c7a4).setDepth(6);
    this.stageLabel = this.add.text(22, 22, "", {
      fontFamily: "system-ui",
      fontSize: "13px",
      color: "#f4dbab",
      fontStyle: "bold",
    });
    this.add.text(22, 44, "고요한 회랑", {
      fontFamily: "system-ui",
      fontSize: "24px",
      color: "#f3f0e3",
      fontStyle: "bold",
    });
    this.statusLabel = this.add.text(22, 77, "", {
      fontFamily: "system-ui",
      fontSize: "11px",
      color: "#9bb7b1",
    });
    this.add.rectangle(22, h - 44, w - 44, 3, 0x11222a).setOrigin(0);
    this.progressBar = this.add
      .rectangle(22, h - 44, 0, 3, 0xdeb780)
      .setOrigin(0);
    this.add
      .text(w / 2, h - 24, "화면을 탭해 3분 생존 전투 시작  →", {
        fontFamily: "system-ui",
        fontSize: "12px",
        color: "#e4d4b7",
      })
      .setOrigin(0.5);
  }
  update(time, delta) {
    const state = store.getState(),
      stats = computeCombatStats(state.character);
    const dt = Math.min(delta, 50),
      active = state.settings.autoProgress !== false,
      fraction = this.progress.distancePx / STAGE_LENGTH_PX;
    const direction = fraction < 0.5 ? 1 : -1,
      x =
        46 +
        (this.scale.width - 92) *
          (fraction < 0.5 ? fraction * 2 : (1 - fraction) * 2);
    this.character.x = x;
    this.character.y =
      this.scale.height * 0.7 + (active ? Math.sin(time / 120) * 2 : 0);
    this.character.setFlipX(direction < 0);
    this.shadow.x = x;
    this.room.x = -((this.progress.distancePx * 0.3) % 112);
    this.hpTrack.setPosition(x, this.character.y + 24);
    this.hpFill.setPosition(x, this.character.y + 24);
    this.hpFill.width = (38 * this.idleHp) / 100;
    this.enemy.x = Phaser.Math.Clamp(
      x + direction * 64,
      25,
      this.scale.width - 25,
    );
    this.enemy.y = this.scale.height * 0.7 + Math.sin(time / 180) * 3;
    this.enemy.setFlipX(direction > 0);
    this.effects.clear();
    if (stats.aura) {
      this.effects.lineStyle(
        2,
        stats.aura === "fury" ? 0xe5b46f : 0x77d3b3,
        0.4,
      );
      this.effects.strokeCircle(x, this.character.y, 70);
    }
    if (this.idleEnemy.curseTimer > 0) {
      this.effects.lineStyle(
        2,
        this.idleEnemy.curse === "chill" ? 0x8dd9f1 : 0xeb97bb,
        0.8,
      );
      this.effects.strokeCircle(this.enemy.x, this.enemy.y, 25);
    }
    this.effectsLabel.setText(
      [
        stats.aura === "fury"
          ? "분노 오라"
          : stats.aura === "renewal"
            ? "회복 오라"
            : "",
        stats.curse === "chill"
          ? "한기 저주"
          : stats.curse === "frailty"
            ? "분쇄 저주"
            : "",
        stats.slow ? "서리장막 둔화" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
    this.stageLabel.setText(
      `STAGE ${String(this.progress.stageIndex + 1).padStart(2, "0")}  /  별빛 미궁`,
    );
    this.statusLabel.setText(
      active
        ? "● 자동 탐험 중 · 장비와 경험치를 수집합니다"
        : "Ⅱ 탐험 일시 정지 · 설정에서 다시 시작",
    );
    this.progressBar.width = (this.scale.width - 44) * fraction;
    if (!active || document.hidden || document.querySelector("dialog[open]"))
      return;
    this.idleHp = Math.min(
      100,
      this.idleHp +
        ((1 +
          stats.def * 0.12 +
          stats.regen +
          (stats.aura === "renewal"
            ? stats.auraLevel * 0.6 + stats.defenseSynergy
            : 0)) *
          dt) /
          1000,
    );
    advanceIdleProgress(this.progress, dt);
    this.tickAccumulator += dt;
    this.idleHp = Math.max(
      1,
      this.idleHp - advanceIdleEnemy(this.idleEnemy, dt, stats),
    );
    const interval = Math.max(300, 1000 - stats.atk * 5);
    if (this.tickAccumulator >= interval) {
      this.tickAccumulator -= interval;
      const { damage, critical, healing } = strikeIdleEnemy(
        this.idleEnemy,
        stats,
      );
      this.idleHp = Math.min(100, this.idleHp + healing);
      if (this.idleEnemy.hp > 0) {
        floatingText(
          this,
          this.enemy.x,
          this.enemy.y - 18,
          String(Math.round(damage)),
          critical ? "#ffa5b0" : "#efd59a",
        );
      }
      const slash = this.add
        .arc(this.enemy.x, this.enemy.y, 24, -60, 60, false, 0xffdc9a, 0.65)
        .setDepth(5);
      this.tweens.add({
        targets: slash,
        alpha: 0,
        scale: 1.5,
        duration: 230,
        onComplete: () => slash.destroy(),
      });
      if (this.idleEnemy.hp <= 0) {
        const result = resolveIdleKill({
          character: state.character,
          currency: state.currency,
          inventory: state.inventory,
          scrapbook: state.scrapbook,
          autoEquipMinGrade: state.settings.autoEquipMinGrade,
        });
        applyLevelUps(state.character);
        awardMaterials(state);
        recordLoot(state, result.item, {
          equipped: result.autoEquipResult.equipped,
          convertedToGold: result.convertedToGold,
        });
        this.idleEnemy = {
          hp: 10 + Math.min(20, this.progress.stageIndex * 2),
        };
        this.enemy.setTexture(
          ["slime", "bat", "skull"][Math.floor(time / 1000) % 3],
        );
        floatingText(
          this,
          this.enemy.x,
          this.enemy.y - 20,
          `+${result.goldDrop}G · +${result.expDrop}XP`,
        );
        store.notify();
      }
      sound("hit");
    }
  }
}
