import { GRADE_ORDER } from "../data/dropTable.js";
const STORAGE_KEY = "claude_game_save_v1";

function resolveStorage(storage) {
  return storage || globalThis.localStorage;
}

export function saveState(state, storage) {
  try {
    resolveStorage(storage).setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // storage unavailable or quota exceeded — continue without persisting this save
  }
}

export function loadState(storage) {
  let raw;
  try {
    raw = resolveStorage(storage).getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
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
