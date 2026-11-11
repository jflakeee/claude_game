import { describe, expect, it } from "vitest";
import { claimWriter, renewWriter, releaseWriter, WRITER_KEY } from "../../src/state/tabWriter.js";

function storage() {
  const map = new Map();
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
  };
}

describe("P0-E tab writer lease", () => {
  it("blocks a second tab while the first lease is live", () => {
    const disk = storage();
    expect(claimWriter(disk, "first", 100)).toBe(true);
    expect(claimWriter(disk, "second", 101)).toBe(false);
    expect(renewWriter(disk, "first", 102)).toBe(true);
    expect(renewWriter(disk, "second", 103)).toBe(false);
  });

  it("allows recovery of an expired lease without deleting another owner", () => {
    const disk = storage();
    expect(claimWriter(disk, "first", 100)).toBe(true);
    expect(claimWriter(disk, "second", 16000)).toBe(true);
    releaseWriter(disk, "first");
    expect(JSON.parse(disk.getItem(WRITER_KEY)).owner).toBe("second");
    releaseWriter(disk, "second");
    expect(disk.getItem(WRITER_KEY)).toBeNull();
  });

  it("refuses writes if lease storage cannot be accessed", () => {
    const unavailable = { getItem() { throw new Error("blocked"); } };
    expect(claimWriter(unavailable, "first", 100)).toBe(false);
  });
});
