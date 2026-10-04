import { store } from "../state/globalStore.js";
let motionQuery;

export function motionEnabled() {
  motionQuery ||= globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  return store.getState().settings.motion !== false &&
    !motionQuery?.matches;
}

export function rewardFlight(scene, x, y, selector) {
  if (!motionEnabled() || (scene.rewardFlights || 0) >= 5) return;
  const target = document.querySelector(selector);
  if (!target) return;
  const canvas = scene.game.canvas.getBoundingClientRect(), end = target.getBoundingClientRect();
  const camera = scene.cameras.main;
  const startX = canvas.left + (x - camera.scrollX) * canvas.width / scene.scale.width;
  const startY = canvas.top + (y - camera.scrollY) * canvas.height / scene.scale.height;
  const coin = document.createElement("span");
  coin.className = "reward-flight";
  coin.setAttribute("aria-hidden", "true");
  coin.textContent = "✦";
  coin.style.left = `${startX}px`; coin.style.top = `${startY}px`;
  document.body.append(coin);
  scene.rewardFlights = (scene.rewardFlights || 0) + 1;
  const animation = coin.animate([
    { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
    { transform: `translate(${end.left + end.width / 2 - startX}px, ${end.top + end.height / 2 - startY}px) scale(0.4)`, opacity: 0 }
  ], { duration: 420, easing: "cubic-bezier(.2,.6,.4,1)" });
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    scene.events.off("shutdown", cleanup);
    animation.cancel(); coin.remove(); scene.rewardFlights--;
  };
  animation.onfinish = cleanup;
  scene.events.once("shutdown", cleanup);
}

// Presentation-only health history: never writes back into combat state.
export function advanceHealthTrail(state, hp, delta) {
  hp = Math.max(0, Math.min(100, hp));
  if (hp < state.hp - 0.01) state.hold = 150;
  if (hp > state.trail) state.trail = hp;
  state.hp = hp;
  if (state.hold > 0) state.hold = Math.max(0, state.hold - delta);
  else state.trail = Math.max(hp, state.trail - delta / 3);
  return state.trail;
}

export function deathEcho(scene, sprite) {
  if (!sprite?.active || !motionEnabled()) return;
  const echo = scene.add.image(sprite.x, sprite.y, sprite.texture.key)
    .setScale(sprite.scaleX, sprite.scaleY).setFlipX(sprite.flipX)
    .setTint(sprite.tintTopLeft).setDepth(4).setAlpha(0.7);
  scene.tweens.add({ targets: echo, alpha: 0, scaleX: echo.scaleX * 0.65,
    scaleY: echo.scaleY * 0.65, duration: 200, onComplete: () => echo.destroy() });
}

export function flashSprite(scene, sprite, baseTint = 0xffffff) {
  if (!sprite?.active) return;
  sprite.hitRestore?.remove();
  sprite.setTintFill(0xffedba);
  sprite.hitRestore = scene.time.delayedCall(65, () => {
    if (sprite.active) sprite.setTint(baseTint);
  });
}
