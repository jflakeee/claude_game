import {
  createCombatSession,
  settleCombat,
  addReward,
} from "./survivalCombat.js";
import { receiveItem } from "./items.js";
import { applyLevelUps } from "./leveling.js";
import { awardMaterials } from './crafting.js';
import { rollItem } from './items.js';

export function beginCombat(state, encounter='survival') {
  state.combatSession = {
    ...createCombatSession(),
    kills: 0,
    hp: 100,
    encounter,
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
  awardMaterials(state,session.kills||0);
  if(outcome==='cleared'&&session.encounter==='boss'){
    state.progression.bossWins++;
    for(const key of ['ember','frost','ward'])state.materials[key]+=2;
    addReward(session,{gold:150,exp:100,item:rollItem(Math.random,{grade:'epic',identified:true})});
  }
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
    encounter: session.encounter,
  };
  state.combatSession = null;
  state.runState.mode = "idle";
  state.runState.combatTimer = 0;
  return state.lastResult;
}
