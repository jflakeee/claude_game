import { describe, it, expect } from "vitest";
import { advanceHealthTrail } from "../../src/systems/presentation.js";

describe("health history", () => {
  it("holds damage then catches up without changing authoritative HP", () => {
    const state = { hp: 100, trail: 100, hold: 0 };
    expect(advanceHealthTrail(state, 60, 50)).toBe(100);
    advanceHealthTrail(state, 60, 100);
    expect(advanceHealthTrail(state, 60, 90)).toBe(70);
    expect(advanceHealthTrail(state, 60, 90)).toBe(60);
  });
  it("handles healing and repeated damage without crossing the real bar", () => {
    const state = { hp: 50, trail: 70, hold: 0 };
    expect(advanceHealthTrail(state, 90, 16)).toBe(90);
    expect(advanceHealthTrail(state, 40, 16)).toBe(90);
    expect(advanceHealthTrail(state, 20, 16)).toBe(90);
    advanceHealthTrail(state, 20, 150);
    expect(advanceHealthTrail(state, 20, 1000)).toBe(20);
  });
});
