export const COMBAT_DURATION_MS = 180000;

export function createCombatSession(now = Date.now()) {
  return { startedAt: now, elapsedMs: 0, rewards: { gold: 0, exp: 0, items: [] }, outcome: null };
}

export function tickCombat(session, deltaMs, playerHp) {
  session.elapsedMs += deltaMs;
  if (playerHp <= 0) {
    session.outcome = 'failed';
    return session;
  }
  if (session.elapsedMs >= COMBAT_DURATION_MS) {
    session.outcome = 'cleared';
  }
  return session;
}

export function addReward(session, reward) {
  session.rewards.gold += reward.gold || 0;
  session.rewards.exp += reward.exp || 0;
  if (reward.item) session.rewards.items.push(reward.item);
}

export function settleCombat(session, currency, character) {
  currency.gold += session.rewards.gold;
  character.exp += session.rewards.exp;
  return { outcome: session.outcome, rewards: session.rewards };
}
