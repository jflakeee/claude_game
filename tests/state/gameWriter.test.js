import { describe, it, expect } from "vitest";
import { acquireGameWriter } from "../../src/state/gameWriter.js";
function storage() {
  const data = new Map();
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: k => data.delete(k),
  };
}
function mockLocks() {
  let locked = false;
  return {
    async request(_name, _options, callback) {
      if (locked) return callback(null);
      locked = true;
      try { return await callback({ name: _name }); }
      finally { locked = false; }
    },
  };
}
describe("Web Locks single writer", () => {
  it("holds exclusive ownership until released", async () => {
    const disk = storage();
    const locks = mockLocks();
    const first = await acquireGameWriter({ storage: disk, owner: "first", locks });
    expect(first.ok).toBe(true);
    expect(first.guard()).toBe(true);
    const second = await acquireGameWriter({ storage: disk, owner: "second", locks });
    expect(second.ok).toBe(false);
    first.release();
    await first.done;
    const next = await acquireGameWriter({ storage: disk, owner: "second", locks });
    expect(next.ok).toBe(true);
    next.release();
    await next.done;
  });
  it("does not override a live legacy lease", async () => {
    const disk = storage();
    const fallback = await acquireGameWriter({ storage: disk, owner: "legacy", locks: null });
    const guarded = await acquireGameWriter({ storage: disk, owner: "web", locks: mockLocks() });
    expect(fallback.ok).toBe(true);
    expect(guarded.ok).toBe(false);
    fallback.release();
  });
  it("falls back to the legacy lease when Web Locks are unavailable", async () => {
    const disk = storage();
    const a = await acquireGameWriter({ storage: disk, owner: "a", locks: null });
    const b = await acquireGameWriter({ storage: disk, owner: "b", locks: null });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
    a.release();
  });
});
