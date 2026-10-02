import Phaser from 'phaser';
import { IdleScene } from './scenes/IdleScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: 'game-container',
  backgroundColor: '#1b1b1b',
  scene: [IdleScene],
});
