import { describe, it, expect, beforeEach } from "vitest";
import { runWithFailover } from "./failover";
import { _resetProviderHealthRegistry, getProviderHealth } from "./registry";

describe("runWithFailover", () => {
  beforeEach(() => _resetProviderHealthRegistry());

  it("returns PRIMARY when it succeeds", async () => {
    const res = await runWithFailover(
      { providerId: "P", fetch: async () => ({ data: 42, ageSeconds: 5 }) },
      { providerId: "S", fetch: async () => ({ data: 0 }) },
    );
    expect(res.source).toBe("PRIMARY");
    expect(res.data).toBe(42);
    expect(getProviderHealth("P")!.code).toBe("HEALTHY");
  });

  it("falls back to SECONDARY when primary throws", async () => {
    const res = await runWithFailover(
      { providerId: "P", fetch: async () => { throw new Error("boom"); } },
      { providerId: "S", fetch: async () => ({ data: "ok", ageSeconds: 0 }) },
    );
    expect(res.source).toBe("SECONDARY");
    expect(res.data).toBe("ok");
    expect(getProviderHealth("P")!.code).not.toBe("HEALTHY");
    expect(getProviderHealth("S")!.code).toBe("HEALTHY");
  });

  it("falls back to CACHE when both providers fail", async () => {
    const res = await runWithFailover(
      { providerId: "P", fetch: async () => { throw new Error("x"); } },
      { providerId: "S", fetch: async () => { throw new Error("y"); } },
      { get: () => ({ data: "cached", ageSeconds: 120 }), maxAgeSeconds: 600 },
    );
    expect(res.source).toBe("CACHE");
    expect(res.data).toBe("cached");
  });

  it("returns UNAVAILABLE when cache too stale or absent", async () => {
    const res = await runWithFailover(
      { providerId: "P", fetch: async () => { throw new Error("x"); } },
      null,
      { get: () => ({ data: "old", ageSeconds: 10_000 }), maxAgeSeconds: 900 },
    );
    expect(res.source).toBe("UNAVAILABLE");
    expect(res.data).toBeNull();
    expect(res.errors.length).toBeGreaterThan(0);
  });
});