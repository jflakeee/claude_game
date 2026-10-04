import Phaser from "phaser";
import { IdleScene } from "./scenes/IdleScene.js";
import { CombatScene } from "./scenes/CombatScene.js";
import { store } from "./state/globalStore.js";
import { saveState, loadState, hydrateState } from "./state/persistence.js";
import { mountBottomPanel, showToast } from "./ui/BottomPanel.js";
import { finishCombat } from "./systems/combatLifecycle.js";
import { unlockAudio } from "./audio.js";
import { ensureMarket, tickMarket } from "./systems/market.js";
import { motionEnabled } from "./systems/presentation.js";

store.setState(hydrateState(loadState(), store.getState()));
tickMarket(store.getState());
ensureMarket(store.getState());
setInterval(() => {
  const state = store.getState();
  const changed = tickMarket(state);
  const refreshed = ensureMarket(state);
  if (changed || refreshed) {
    saveState(state);
    store.notify();
  }
}, 1000);
if (store.getState().combatSession) {
  finishCombat(store.getState(), "interrupted");
  saveState(store.getState());
}
document
  .querySelector("#app")
  .insertAdjacentHTML(
    "afterbegin",
    '<header class="game-header"><div class="brand"><span class="brand-mark">✳</span><div><span class="eyebrow">THE STARLIGHT LABYRINTH</span><h1>Claude Game</h1></div></div><div class="wallet"><b id="gold-value">0 G</b><small id="level-value">Lv.1 · 0/50 XP</small></div></header>',
  );
document
  .querySelector("#app")
  .insertAdjacentHTML(
    "beforeend",
    '<div id="toast" role="status" aria-live="polite"></div><dialog id="result-dialog" aria-labelledby="result-title"><span class="result-icon">✧</span><span class="eyebrow">EXPEDITION REPORT</span><h2 id="result-title"></h2><p id="result-description"></p><div class="result-rewards"></div><button class="primary" id="dismiss-result">탐험 계속</button></dialog>',
  );
mountBottomPanel(document.getElementById("bottom-panel"));
const dialog = document.getElementById("result-dialog");
let shownResult = null,
  lastItemId = null;
let displayedGold = null, goldTarget = null, goldFrame = 0;
function showGold(value) {
  if (value === goldTarget && motionEnabled()) return;
  goldTarget = value;
  cancelAnimationFrame(goldFrame);
  const label = document.getElementById("gold-value");
  const write = number => { label.textContent = `${Math.round(number).toLocaleString()} G`; };
  if (displayedGold === null || !motionEnabled() || value < displayedGold) {
    displayedGold = value;
    write(value);
    return;
  }
  const from = displayedGold, start = performance.now();
  const tick = now => {
    const t = motionEnabled() ? Math.min(1, (now - start) / 280) : 1;
    displayedGold = from + (value - from) * (1 - (1 - t) ** 3);
    write(displayedGold);
    if (t < 1) goldFrame = requestAnimationFrame(tick);
  };
  goldFrame = requestAnimationFrame(tick);
}
function refresh() {
  const s = store.getState();
  document.documentElement.classList.toggle("motion-off", s.settings.motion === false);
  showGold(s.currency.gold);
  document.getElementById("level-value").textContent =
    `Lv.${s.character.level} · ${s.character.exp}/${s.character.level * 50} XP`;
  const notice = s.lootNotice;
  if (notice && notice.id !== lastItemId && s.settings.notifications)
    showToast(notice.message);
  lastItemId = notice?.id;
  if (s.lastResult && s.lastResult !== shownResult &&
      !document.getElementById("app").classList.contains("result-pending")) {
    shownResult = s.lastResult;
    const r = s.lastResult;
    document.getElementById("result-title").textContent =
      {
        cleared: r.encounter === "boss" ? "보스 격파!" : "생존 성공!",
        failed: "다시 도전해요",
        escaped: "안전하게 귀환",
        interrupted: "탐험 기록 복구",
      }[r.outcome] || "탐험 완료";
    document.getElementById("result-description").textContent =
      `${r.kills || 0}마리 처치 · ${Math.floor((r.elapsedMs || 0) / 1000)}초 생존. 획득한 보상을 모두 받았습니다.${r.encounter === "boss" && r.outcome === "cleared" ? " 화염·서리·수호 룬 각각 2개 획득!" : ""}`;
    dialog.querySelector(".result-rewards").innerHTML =
      `<div><b>${r.gold}</b><small>GOLD</small></div><div><b>${r.exp}</b><small>EXP</small></div><div><b>${r.items}</b><small>장비</small></div>`;
    dialog.showModal();
  }
}
function dismiss() {
  dialog.close();
  store.getState().lastResult = null;
  saveState(store.getState());
}
document.getElementById("dismiss-result").addEventListener("click", dismiss);
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  dismiss();
});
store.subscribe(refresh);
refresh();
const persist = () => saveState(store.getState());
setInterval(persist, 5000);
window.addEventListener("pagehide", persist);
window.addEventListener("beforeunload", persist);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) persist();
});
document.addEventListener("pointerdown", unlockAudio, { passive: true });
document.addEventListener("keydown", unlockAudio);
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#132229",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: document.getElementById("game-container").clientWidth,
    height: document.getElementById("game-container").clientHeight,
  },
  scene: [IdleScene, CombatScene],
});
const observer = new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  if (width > 0 && height > 0) game.scale.setParentSize(width, height);
});
observer.observe(document.getElementById("game-container"));
if (import.meta.env.DEV) window.__claudeGame = { game, store };
