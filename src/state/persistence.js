const STORAGE_KEY = 'claude_game_save_v1';

function resolveStorage(storage) {
  return storage || globalThis.localStorage;
}

export function saveState(state, storage) {
  resolveStorage(storage).setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(storage) {
  const raw = resolveStorage(storage).getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearState(storage) {
  resolveStorage(storage).removeItem(STORAGE_KEY);
}
