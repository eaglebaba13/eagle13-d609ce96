import { describe, expect, it } from "vitest";
import { computeNifty50Breadth, computeWeightedBreadth } from "./weighted-breadth";
import { TOP10_REGISTRY } from "./top10-registry";
import type { QuoteSnapshot } from "./types";

const q = (symbol: string, changePct: number | null): QuoteSnapshot => ({ symbol, last: null, changePct });

describe("Phase 49 — TOP10_REGISTRY", () => {
  it("has 10 constituents summing to 1.0", () => {
    expect(TOP10_REGISTRY.length).toBe(10);
    const sum = TOP10_REGISTRY.reduce((s, r) => s + r.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });
});

describe("Phase 49 — computeWeightedBreadth", () => {
  it("marks PROVIDER_PENDING when no quotes resolve", () => {
    const r = computeWeightedBreadth([]);
    expect(r.status).toBe("PROVIDER_PENDING");
    expect(r.coverage).toBe(0);
  });

  it("computes positive weight when top-weighted stocks rally", () => {
    const quotes = TOP10_REGISTRY.map((c) => q(c.yahooSymbol, 1.5));
    const r = computeWeightedBreadth(quotes);
    expect(r.status).toBe("LIVE");
    expect(r.positiveWeightPct).toBe(100);
    expect(r.weightedBreadthScore).toBeGreaterThan(0);
  });

  it("computes negative weight when top-weighted stocks decline", () => {
    const quotes = TOP10_REGISTRY.map((c) => q(c.yahooSymbol, -1.5));
    const r = computeWeightedBreadth(quotes);
    expect(r.negativeWeightPct).toBe(100);
    expect(r.weightedBreadthScore).toBeLessThan(0);
  });
});

describe("Phase 49 — computeNifty50Breadth", () => {
  it("returns PROVIDER_PENDING with zero rows", () => {
    const r = computeNifty50Breadth([]);
    expect(r.status).toBe("PROVIDER_PENDING");
    expect(r.total).toBe(0);
  });

  it("computes advance/decline metrics", () => {
    const rows: QuoteSnapshot[] = [
      ...Array.from({ length: 30 }, (_, i) => q(`A${i}`, 1)),
      ...Array.from({ length: 15 }, (_, i) => q(`B${i}`, -1)),
      ...Array.from({ length: 5 }, (_, i) => q(`C${i}`, 0)),
    ];
    const r = computeNifty50Breadth(rows);
    expect(r.advancing).toBe(30);
    expect(r.declining).toBe(15);
    expect(r.unchanged).toBe(5);
    expect(r.total).toBe(50);
    expect(r.advanceDeclineRatio).toBe(2);
    expect(r.status).toBe("LIVE");
  });
});