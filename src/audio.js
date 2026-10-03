import { store } from "./state/globalStore.js";
let context;
export function unlockAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    if (context.state === "suspended") context.resume().catch(() => {});
  } catch {
    /* Audio is optional. */
  }
}
export function sound(kind = "click") {
  if (
    !context ||
    context.state !== "running" ||
    !store.getState().settings.sound
  )
    return;
  const oscillator = context.createOscillator(),
    gain = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(
    { click: 440, hit: 180, reward: 740, hurt: 90 }[kind] || 440,
    context.currentTime,
  );
  oscillator.frequency.exponentialRampToValueAtTime(
    kind === "reward" ? 1100 : 80,
    context.currentTime + 0.09,
  );
  gain.gain.setValueAtTime(0.025, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.13);
}
