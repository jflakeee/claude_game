export function arenaBounds(width, height, encounter = "survival") {
  const top = Math.min(height - 100, encounter === "boss" ? 210 : 140);
  return {
    top,
    bottom: Math.max(top + 40, height - 40),
    left: 20,
    right: Math.max(20, width - 20),
  };
}
export function bossLayout(width, height) {
  const { top, bottom } = arenaBounds(width, height, "boss");
  return {
    x: width / 2,
    y: top + (bottom - top) * 0.3,
    radius: Math.min(95, width * 0.28, (bottom - top) * 0.35),
  };
}
