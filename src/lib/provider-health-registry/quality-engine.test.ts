import { describe, it, expect } from "vitest";
import { validateRecord } from "./quality-engine";

describe("data quality engine", () => {
  const now = Date.parse("2026-07-29T08:00:00Z");

  it("returns OK for a clean record", () => {
    const r = validateRecord({
      timestamp: now - 1_000,
      nowMs: now,
      strike: 22000,
      lastPrice: 105.5,
      volume: 100,
      openInterest: 250,
    });
    expect(r.ok).toBe(true);
    expect(r.codes).toEqual([]);
    expect(r.score).toBe(100);
  });

  it("flags stale and future timestamps", () => {
    expect(validateRecord({ timestamp: now - 60 * 60 * 1000, nowMs: now }).codes).toContain("STALE_TIMESTAMP");
    expect(validateRecord({ timestamp: now + 5 * 60 * 1000, nowMs: now }).codes).toContain("FUTURE_TIMESTAMP");
  });

  it("flags duplicates, invalid prices, negatives, missing strike", () => {
    const seen = new Set(["r1"]);
    const r = validateRecord({
      nowMs: now,
      recordId: "r1",
      seenIds: seen,
      strike: -1,
      lastPrice: 0,
      volume: -5,
    });
    expect(r.codes).toEqual(
      expect.arrayContaining(["DUPLICATE_RECORD", "MISSING_STRIKE", "INVALID_PRICE", "NEGATIVE_VALUE"]),
    );
    expect(r.ok).toBe(false);
    expect(r.score).toBeLessThan(100);
  });

  it("flags zero volume / OI only when required", () => {
    expect(validateRecord({ nowMs: now, volume: 0 }).codes).not.toContain("ZERO_VOLUME");
    expect(validateRecord({ nowMs: now, volume: 0, requireVolume: true }).codes).toContain("ZERO_VOLUME");
    expect(validateRecord({ nowMs: now, openInterest: 0, requireOpenInterest: true }).codes).toContain("ZERO_OI");
  });

  it("flags inconsistent expiry and missing greeks", () => {
    expect(
      validateRecord({ nowMs: now, expiry: "2026-08-07", expectedExpiry: "2026-07-31" }).codes,
    ).toContain("INCONSISTENT_EXPIRY");
    expect(validateRecord({ nowMs: now, requireGreeks: true, greeks: { delta: 0.5 } }).codes).toContain(
      "MISSING_GREEKS",
    );
  });
});