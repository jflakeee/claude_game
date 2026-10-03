import Phaser from 'phaser';
import { IdleScene } from './scenes/IdleScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { store } from './state/globalStore.js';
import { saveState, loadState } from './state/persistence.js';
import { mountBottomPanel } from './ui/BottomPanel.js';

const AUTOSAVE_INTERVAL_MS = 10000;

const saved = loadState();
if (saved) {
  const mergedRunState = saved.runState
    ? { ...store.getState().runState, ...saved.runState }
    : store.getState().runState;
  store.setState({ ...saved, runState: mergedRunState });
}

mountBottomPanel(document.getElementById('bottom-panel'));

setInterval(() => {
  saveState(store.getState());
}, AUTOSAVE_INTERVAL_MS);

window.addEventListener('beforeunload', () => {
  saveState(store.getState());
});

new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: 'game-container',
  backgroundColor: '#1b1b1b',
  scene: [IdleScene, CombatScene],
});
