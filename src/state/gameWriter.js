import { claimWriter, renewWriter, releaseWriter } from "./tabWriter.js";

export const WEB_LOCK_NAME = "claude_game_save_writer_v1";

// Hold a browser-managed exclusive lock for the lifetime of the game tab.
// When unavailable, retain the existing localStorage lease behavior.
export async function acquireGameWriter({ storage, owner, locks = globalThis.navigator?.locks, now = () => Date.now() }) {
  if (!locks?.request) {
    const ok = claimWriter(storage, owner, now());
    return {
      ok,
      mode: "lease",
      guard: () => ok && renewWriter(storage, owner, now()),
      release: () => { if (ok) releaseWriter(storage, owner); },
    };
  }

  let resolveAcquired;
  const acquired = new Promise(resolve => { resolveAcquired = resolve; });
  let unlock;
  const held = new Promise(resolve => { unlock = resolve; });
  let active = false;
  const pending = locks.request(WEB_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) {
      resolveAcquired(false);
      return;
    }
    // Do not steal an existing legacy lease held by a fallback client.
    if (!claimWriter(storage, owner, now())) {
      resolveAcquired(false);
      return;
    }
    active = true;
    resolveAcquired(true);
    await held;
    active = false;
    releaseWriter(storage, owner);
  });
  try {
    const ok = await acquired;
    return {
      ok,
      mode: "web-lock",
      guard: () => active && renewWriter(storage, owner, now()),
      release: () => { active = false; unlock(); },
      done: pending,
    };
  } catch {
    unlock();
    return { ok: false, mode: "web-lock", guard: () => false, release: () => {} };
  }
}
