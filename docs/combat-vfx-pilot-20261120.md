# Combat VFX pilot — 2026-11-20

The initial runtime pilot adds a lightweight Phaser-native ring on enemy defeat in `CombatScene`. It is deliberately **not** the upstream pixelfx library and does **not** claim plinkfx runtime integration. Existing `src/audio.js` Web Audio sounds remain unchanged.

- Respects `motionEnabled()`; no effect for reduced motion.
- No save-state changes, timers in persisted state, new dependencies or changes to reward settlement.
- A graphics object is destroyed after a 210 ms tween.
- Follow-up: evaluate upstream pixelfx renderer adapter and plinkfx package with lockfile, asset/license review, bundle budget, audio unlock and mobile performance tests before enabling them.

Safety: branch-only; keep master and Pages unchanged until tested.
