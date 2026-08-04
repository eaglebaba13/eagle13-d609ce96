import { describe, expect, it } from "vitest";
import { computeSectorRotation } from "./sector-strength";
import { II_SECTOR_REGISTRY } from "./sector-registry";
import type { QuoteSnapshot } from "./types";

describe("Phase 49 — computeSectorRotation", () => {
  it("marks PROVIDER_PENDING with no quotes", () => {
    const r = computeSectorRotation([]);
    expect(r.status).toBe("PROVIDER_PENDING");
    expect(r.rows.every((row) => row.bias === "UNAVAILABLE")).toBe(true);
  });

  it("classifies bullish/bearish/neutral sectors", () => {
    const quotes: QuoteSnapshot[] = II_SECTOR_REGISTRY.map((s, i) => ({
      symbol: s.yahooSymbol,
      last: null,
      changePct: i < 4 ? 1.2 : i < 8 ? -1.5 : 0.1,
    }));
    const r = computeSectorRotation(quotes);
    expect(r.status).toBe("LIVE");
    expect(r.bullishCount).toBe(4);
    expect(r.bearishCount).toBe(4);
    expect(r.leaders.length).toBeGreaterThan(0);
    expect(r.laggards.length).toBeGreaterThan(0);
    expect(r.rotationBias).toBe(0);
  });
});