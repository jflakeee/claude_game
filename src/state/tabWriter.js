// A conservative single-writer lease for browser tabs. This is not a
// cross-tab atomic lock; revision checks still protect stale saves.
export const WRITER_KEY = "claude_game_writer_v1";
export const WRITER_TTL_MS = 15000;

export function claimWriter(storage, owner, now = Date.now()) {
  try {
    const current = JSON.parse(storage.getItem(WRITER_KEY) || "null");
    if (current && current.owner !== owner && current.expires > now)
      return false;
    storage.setItem(WRITER_KEY, JSON.stringify({ owner, expires: now + WRITER_TTL_MS }));
    return JSON.parse(storage.getItem(WRITER_KEY) || "null")?.owner === owner;
  } catch {
    return false;
  }
}

export function renewWriter(storage, owner, now = Date.now()) {
  try {
    const current = JSON.parse(storage.getItem(WRITER_KEY) || "null");
    if (!current || current.owner !== owner) return false;
    storage.setItem(WRITER_KEY, JSON.stringify({ owner, expires: now + WRITER_TTL_MS }));
    return JSON.parse(storage.getItem(WRITER_KEY) || "null")?.owner === owner;
  } catch {
    return false;
  }
}

export function releaseWriter(storage, owner) {
  try {
    if (JSON.parse(storage.getItem(WRITER_KEY) || "null")?.owner === owner)
      storage.removeItem(WRITER_KEY);
  } catch {
    // A failed cleanup must never delete another tab's lease.
  }
}
