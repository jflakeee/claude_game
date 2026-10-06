// Shared geometry for the encounter rules and their readable world-space cues.
export const HAZARD_GEOMETRY = Object.freeze({
  blastRadius: 48,
  chargeHalfWidth: 22,
  playerContactRadius: 23,
  enemyShotRadius: 17,
  leaderAuraRadius: 100,
  bossShotTargetRadius: 33,
  enemyShotTargetRadius: 19,
});

export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}
