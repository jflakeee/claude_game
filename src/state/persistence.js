import { GRADE_ORDER } from "../data/dropTable.js";
const STORAGE_KEY = "claude_game_save_v1";
export const SAVE_SCHEMA_VERSION = 1;
const listeners = new Set();

export function subscribeSaveStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function report(result) {
  for (const listener of listeners) listener(result);
  return result;
}

function resolveStorage(storage) {
  return storage || globalThis.localStorage;
}

export function readSave(storage) {
  let raw;
  try {
    raw = resolveStorage(storage).getItem(STORAGE_KEY);
  } catch (e) {
    return { status: "unavailable", state: null };
  }
  if (raw === null) return { status: "empty", state: null };
  try {
    const state = JSON.parse(raw);
    if (!state || typeof state !== "object" || Array.isArray(state))
      return { status: "corrupt", state: null };
    if (state.schemaVersion === undefined) return { status: "legacy", state, raw };
    if (state.schemaVersion !== SAVE_SCHEMA_VERSION)
      return { status: "unsupported", state: null };
    if (!Number.isSafeInteger(state.revision) || state.revision < 0)
      return { status: "corrupt", state: null };
    return { status: "loaded", state };
  } catch (e) {
    return { status: "corrupt", state: null };
  }
}

export function loadState(storage) {
  return readSave(storage).state;
}

export function saveState(state, storage) {
  const current = readSave(storage);
  if (!["empty", "legacy", "loaded"].includes(current.status))
    return report({ ok: false, reason: current.status });
  const revision = state.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0 ||
      (state.schemaVersion !== undefined && state.schemaVersion !== SAVE_SCHEMA_VERSION))
    return report({ ok: false, reason: "unsupported" });
  // Detect stale writers; this is not a cross-tab transaction lock.
  if (current.status === "loaded" && current.state.revision !== revision)
    return report({ ok: false, reason: "conflict" });
  try {
    const target = resolveStorage(storage);
    const nextRevision = revision + 1;
    if (!Number.isSafeInteger(nextRevision)) return report({ ok: false, reason: "unsupported" });
    const raw = JSON.stringify({ ...state, schemaVersion: SAVE_SCHEMA_VERSION, revision: nextRevision });
    if (current.status === "legacy" && target.getItem(`${STORAGE_KEY}_legacy_backup`) === null)
      target.setItem(`${STORAGE_KEY}_legacy_backup`, current.raw);
    target.setItem(STORAGE_KEY, raw);
    state.schemaVersion = SAVE_SCHEMA_VERSION;
    state.revision = nextRevision;
    return report({ ok: true, revision: nextRevision });
  } catch (e) {
    return report({ ok: false, reason: "unavailable" });
  }
}

export function clearState(storage) {
  try {
    resolveStorage(storage).removeItem(STORAGE_KEY);
  } catch (e) {
    // storage unavailable — nothing to clear
  }
}

// Merge older saves without allowing missing fields to break a scene.
export function hydrateState(saved, defaults) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved))
    return defaults;
  const number = (value, fallback) =>
    Number.isFinite(value) && value >= 0 ? value : fallback;
  const character = saved.character || {};
  const items = (value) =>
    Array.isArray(value)
      ? value.filter(
          (i) =>
            i &&
            typeof i.id === "string" &&
            GRADE_ORDER.includes(i.grade) &&
            i.slot &&
            i.statBonus,
        )
      : [];
  const merged = {
    ...defaults,
    schemaVersion: SAVE_SCHEMA_VERSION,
    revision: Number.isSafeInteger(saved.revision) && saved.revision >= 0 ? saved.revision : 0,
    character: {
      ...defaults.character,
      ...character,
      level: Math.max(1, number(character.level, 1)),
      exp: number(character.exp, 0),
      skillPoints: number(character.skillPoints, 0),
      stats: { ...defaults.character.stats, ...character.stats },
      skills: character.skills || {},
      equippedItems: items(character.equippedItems),
    },
    currency: { gold: number(saved.currency?.gold, 0) },
    inventory: items(saved.inventory),
    scrapbook: items(saved.scrapbook),
    settings: { ...defaults.settings, ...saved.settings },
    materials: Object.fromEntries(
      Object.keys(defaults.materials).map((key) => [
        key,
        Math.floor(number(saved.materials?.[key], defaults.materials[key])),
      ]),
    ),
    progression: {
      ...defaults.progression,
      kills: Math.floor(number(saved.progression?.kills, 0)),
      bossWins: Math.floor(number(saved.progression?.bossWins, 0)),
      firstGrowthComplete: typeof saved.progression?.firstGrowthComplete === "boolean"
        ? saved.progression.firstGrowthComplete
        : number(saved.progression?.kills, 0) > 0 && items(character.equippedItems).length > 0,
    },
    market: {
      ...defaults.market,
      ...saved.market,
      ...Object.fromEntries(
        ["stock", "buyback", "auctions", "deliveries", "history"].map((key) => [
          key,
          Array.isArray(saved.market?.[key]) ? saved.market[key] : [],
        ]),
      ),
    },
    runState: {
      ...defaults.runState,
      ...saved.runState,
      mode: "idle",
      distancePx: number(saved.runState?.distancePx, 0),
      stageIndex: number(saved.runState?.stageIndex, 0),
    },
    lastResult: saved.lastResult && typeof saved.lastResult === 'object' &&
      ['cleared', 'failed', 'escaped', 'interrupted'].includes(saved.lastResult.outcome) &&
      Number.isFinite(saved.lastResult.gold) && Number.isFinite(saved.lastResult.exp)
      ? {
          ...saved.lastResult,
          gold: number(saved.lastResult.gold, 0),
          exp: number(saved.lastResult.exp, 0),
          items: Math.floor(number(saved.lastResult.items, 0)),
          drops: Array.isArray(saved.lastResult.drops) ? saved.lastResult.drops.filter(d => d?.item?.id && typeof d.item.name === 'string').slice(0, 30) : [],
          beforeCharacter: saved.lastResult.beforeCharacter && typeof saved.lastResult.beforeCharacter === 'object'
            ? saved.lastResult.beforeCharacter
            : null,
        }
      : null,
  };
  const session = saved.combatSession;
  if (
    session &&
    !session.settled &&
    session.rewards &&
    Number.isFinite(session.rewards.gold) &&
    Number.isFinite(session.rewards.exp)
  ) {
    merged.combatSession = {
      ...session,
      rewards: {
        gold: number(session.rewards.gold, 0),
        exp: number(session.rewards.exp, 0),
        items: items(session.rewards.items),
      },
    };
  }
  return merged;
}
