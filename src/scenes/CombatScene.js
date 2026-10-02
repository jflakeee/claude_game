import Phaser from 'phaser';
import { store } from '../state/globalStore.js';
import {
  createCombatSession,
  tickCombat,
  addReward,
  settleCombat,
  COMBAT_DURATION_MS,
} from '../systems/survivalCombat.js';
import { applyLevelUps } from '../systems/leveling.js';
import { computeEffectiveStats } from '../systems/effectiveStats.js';

const ENEMY_HIT_INTERVAL_MS = 800;
const ENEMY_HIT_DAMAGE = 5;
const PLAYER_MOVE_SPEED = 150;
const CLEAR_REWARD = { gold: 50, exp: 30 };

export class CombatScene extends Phaser.Scene {
  constructor() {
    super('CombatScene');
  }

  create() {
    this.session = createCombatSession();
    this.playerHp = 100;

    const state = store.getState();
    this.effectiveStats = computeEffectiveStats(state.character);

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x222222).setOrigin(0, 0);
    this.player = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 20, 20, 0xe07856);

    this.timerText = this.add.text(10, 10, '', { fontSize: '16px', color: '#ffffff' });
    this.hpText = this.add.text(10, 32, '', { fontSize: '14px', color: '#ff8888' });

    this.add
      .text(this.scale.width - 70, 10, '← 나가기', { fontSize: '14px', color: '#aaaaaa' })
      .setInteractive()
      .on('pointerdown', () => this.endCombat());

    this.cursors = this.input.keyboard ? this.input.keyboard.createCursorKeys() : null;
    this.enemyHitTimer = this.time.addEvent({
      delay: ENEMY_HIT_INTERVAL_MS,
      loop: true,
      callback: () => {
        const mitigatedDamage = Math.max(1, ENEMY_HIT_DAMAGE - Math.floor(this.effectiveStats.def / 10));
        this.playerHp = Math.max(0, this.playerHp - mitigatedDamage);
      },
    });
  }

  update(time, delta) {
    if (this.session.outcome) return;

    tickCombat(this.session, delta, this.playerHp);

    const remainingMs = Math.max(0, COMBAT_DURATION_MS - this.session.elapsedMs);
    this.timerText.setText(`${Math.ceil(remainingMs / 1000)}s`);
    this.hpText.setText(`HP ${this.playerHp}`);

    if (this.cursors) {
      const step = PLAYER_MOVE_SPEED * (delta / 1000);
      if (this.cursors.left.isDown) this.player.x -= step;
      if (this.cursors.right.isDown) this.player.x += step;
      if (this.cursors.up.isDown) this.player.y -= step;
      if (this.cursors.down.isDown) this.player.y += step;
    }

    if (this.session.outcome === 'cleared') {
      addReward(this.session, CLEAR_REWARD);
      this.endCombat();
    } else if (this.session.outcome === 'failed') {
      this.endCombat();
    }
  }

  endCombat() {
    if (this.enemyHitTimer) this.enemyHitTimer.remove();
    const state = store.getState();
    settleCombat(this.session, state.currency, state.character);
    applyLevelUps(state.character);
    store.notify();
    this.scene.start('IdleScene');
  }
}
