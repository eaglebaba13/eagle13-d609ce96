import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetProviderHealthRegistry,
  getProviderHealth,
  listProviderHealth,
  qualityScore,
  recordProviderSample,
  registerProvider,
} from "./registry";

describe("provider-health-registry", () => {
  beforeEach(() => _resetProviderHealthRegistry());

  it("returns null when provider unknown", () => {
    expect(getProviderHealth("nope")).toBeNull();
  });

  it("registers and reports UNAVAILABLE without samples", () => {
    registerProvider({ providerId: "yahoo", label: "Yahoo" });
    const snap = getProviderHealth("yahoo");
    expect(snap?.code).toBe("UNAVAILABLE");
    expect(snap?.totalSamples).toBe(0);
    expect(snap?.freshness).toBe("UNKNOWN");
  });

  it("classifies HEALTHY when all samples ok and fresh", () => {
    for (let i = 0; i < 3; i++) {
      recordProviderSample({ providerId: "p1", ok: true, latencyMs: 100, ageSeconds: 10 });
    }
    const snap = getProviderHealth("p1")!;
    expect(snap.code).toBe("HEALTHY");
    expect(snap.successRate).toBe(1);
    expect(snap.freshness).toBe("FRESH");
    expect(snap.qualityScore).toBeGreaterThan(70);
  });

  it("classifies DEGRADED when success rate < 0.5", () => {
    recordProviderSample({ providerId: "p2", ok: true, latencyMs: 200, ageSeconds: 5 });
    recordProviderSample({ providerId: "p2", ok: false, latencyMs: 200, ageSeconds: 5, reason: "DEGRADED" });
    recordProviderSample({ providerId: "p2", ok: false, latencyMs: 200, ageSeconds: 5, reason: "DEGRADED" });
    expect(getProviderHealth("p2")!.code).toBe("DEGRADED");
  });

  it("propagates AUTH_REQUIRED / RATE_LIMITED reasons", () => {
    recordProviderSample({ providerId: "p3", ok: false, latencyMs: 50, ageSeconds: 0, reason: "AUTH_REQUIRED" });
    expect(getProviderHealth("p3")!.code).toBe("AUTH_REQUIRED");
    recordProviderSample({ providerId: "p4", ok: false, latencyMs: 50, ageSeconds: 0, reason: "RATE_LIMITED" });
    expect(getProviderHealth("p4")!.code).toBe("RATE_LIMITED");
  });

  it("lists providers sorted by id", () => {
    registerProvider({ providerId: "zeta" });
    registerProvider({ providerId: "alpha" });
    expect(listProviderHealth().map((s) => s.providerId)).toEqual(["alpha", "zeta"]);
  });

  it("qualityScore rewards freshness, low latency, high success", () => {
    expect(qualityScore(1, 10, 100)).toBeGreaterThan(qualityScore(1, 800, 100));
    expect(qualityScore(1, 10, 100)).toBeGreaterThan(qualityScore(0.2, 10, 100));
    expect(qualityScore(1, 10, 100)).toBeGreaterThan(qualityScore(1, 10, 5000));
  });
});