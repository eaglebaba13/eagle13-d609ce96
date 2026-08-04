import { describe, it, expect, beforeEach } from "vitest";
import { instrumentProviderCall, withProvenance } from "./instrumentation";
import { _resetProviderHealthRegistry, getProviderHealth } from "./registry";
import { readProvenance } from "./provenance";

describe("instrumentProviderCall", () => {
  beforeEach(() => _resetProviderHealthRegistry());

  it("records a success sample and returns payload untouched", async () => {
    const payload = { last: 22100, ts: "2026-07-29T09:15:00Z" };
    const res = await instrumentProviderCall({
      providerId: "yahoo",
      label: "Yahoo Finance",
      fetch: async () => payload,
      extractSourceTimestamp: (p) => p.ts,
    });
    expect(res.ok).toBe(true);
    expect(res.data).toEqual(payload);
    expect(res.provenance.providerId).toBe("yahoo");
    expect(res.provenance.sourceTimestamp).toBe("2026-07-29T09:15:00Z");
    expect(getProviderHealth("yahoo")!.code).toBe("HEALTHY");
  });

  it("classifies auth errors deterministically", async () => {
    const res = await instrumentProviderCall({
      providerId: "upstox",
      fetch: async () => {
        throw new Error("HTTP 401 Unauthorized");
      },
    });
    expect(res.ok).toBe(false);
    expect(res.provenance.qualityCodes).toContain("AUTH_REQUIRED");
  });

  it("withProvenance attaches an additive field without mutating base keys", async () => {
    const base = { symbol: "NIFTY", last: 22000 };
    const res = await instrumentProviderCall({
      providerId: "p",
      fetch: async () => base,
    });
    const decorated = withProvenance(res) as typeof base & { __provenance?: unknown };
    expect(decorated?.symbol).toBe("NIFTY");
    expect(decorated?.last).toBe(22000);
    expect(readProvenance(decorated)?.providerId).toBe("p");
  });
});