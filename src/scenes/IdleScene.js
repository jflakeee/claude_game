import Phaser from 'phaser';
import { store } from '../state/globalStore.js';
import {
  advanceIdleProgress,
  resolveIdleKill,
  STAGE_LENGTH_PX,
  IDLE_COMBAT_TICK_MS,
} from '../systems/idleCombat.js';
import { applyLevelUps } from '../systems/leveling.js';
import { computeEffectiveStats } from '../systems/effectiveStats.js';

export class IdleScene extends Phaser.Scene {
  constructor() {
    super('IdleScene');
  }

  create() {
    this.progress = store.getState().runState;
    this.tickAccumulator = 0;
    this.trackWidth = this.scale.width - 80;

    this.character = this.add.rectangle(40, this.scale.height * 0.5, 24, 24, 0xe07856);
    this.character.setStrokeStyle(2, 0xffffff);

    this.add
      .text(8, 8, '탭하여 전투 진입', { fontSize: '12px', color: '#888888' })
      .setDepth(10);

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y < this.scale.height * 0.7) {
        this.scene.start('CombatScene');
      }
    });
  }

  update(time, delta) {
    this.tickAccumulator += delta;
    advanceIdleProgress(this.progress, delta);
    this.character.x = 40 + (this.progress.distancePx / STAGE_LENGTH_PX) * this.trackWidth;

    const state = store.getState();
    const effectiveStats = computeEffectiveStats(state.character);
    const killIntervalMs = Math.max(300, IDLE_COMBAT_TICK_MS - effectiveStats.atk * 5);

    if (this.tickAccumulator >= killIntervalMs) {
      this.tickAccumulator -= killIntervalMs;
      resolveIdleKill({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        scrapbook: state.scrapbook,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
      applyLevelUps(state.character);
      store.notify();
    }
  }
}
