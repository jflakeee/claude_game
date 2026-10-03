import {
  createCombatSession,
  settleCombat,
  addReward,
} from "./survivalCombat.js";
import { receiveItem } from "./items.js";
import { applyLevelUps } from "./leveling.js";

export function beginCombat(state) {
  state.combatSession = {
    ...createCombatSession(),
    kills: 0,
    hp: 100,
    startSnapshot: {
      gold: state.currency.gold,
      exp: state.character.exp,
      stageIndex: state.runState.stageIndex,
    },
  };
  state.runState.mode = "combat";
  state.runState.combatTimer = 0;
  return state.combatSession;
}
export function finishCombat(state, outcome = "escaped") {
  const session = state.combatSession;
  if (!session || session.settled) return null;
  session.outcome = outcome;
  if (outcome === "cleared") addReward(session, { gold: 100, exp: 75 });
  settleCombat(session, state.currency, state.character);
  for (const item of session.rewards.items) receiveItem(state, item);
  applyLevelUps(state.character);
  state.lastResult = {
    outcome,
    gold: session.rewards.gold,
    exp: session.rewards.exp,
    items: session.rewards.items.length,
    kills: session.kills,
    elapsedMs: session.elapsedMs,
  };
  state.combatSession = null;
  state.runState.mode = "idle";
  state.runState.combatTimer = 0;
  return state.lastResult;
}
