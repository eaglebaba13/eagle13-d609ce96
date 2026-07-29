import { describe, expect, it } from "vitest";
import { classifyBias, computeIntelligenceScore } from "./score";

describe("Phase 49 — computeIntelligenceScore", () => {
  it("returns 50/NEUTRAL with 0 confidence when no signals available", () => {
    const r = computeIntelligenceScore({});
    expect(r.score).toBe(50);
    expect(r.bias).toBe("NEUTRAL");
    expect(r.confidence).toBe(0);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("scores strongly bullish when all inputs are bullish", () => {
    const r = computeIntelligenceScore({
      weightedBreadthScore: 1,
      nifty50BreadthPct: 80,
      sectorRotationBias: 1,
      fiiDiiBias: 1,
      vix: 11,
      combinedPcr: 1.3,
      globalCompositeBiasPct: 0.8,
    });
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.bias).toBe("STRONG_BULLISH");
    expect(r.confidence).toBe(1);
  });

  it("scores strongly bearish when all inputs are bearish", () => {
    const r = computeIntelligenceScore({
      weightedBreadthScore: -1,
      nifty50BreadthPct: -80,
      sectorRotationBias: -1,
      fiiDiiBias: -1,
      vix: 28,
      combinedPcr: 0.7,
      globalCompositeBiasPct: -0.8,
    });
    expect(r.score).toBeLessThanOrEqual(25);
    expect(r.bias).toBe("STRONG_BEARISH");
  });

  it("reduces confidence proportional to missing inputs", () => {
    const r = computeIntelligenceScore({ vix: 15, weightedBreadthScore: 0.5 });
    expect(r.confidence).toBeLessThan(1);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.missing).toContain("sectorRotationBias");
  });
});

describe("Phase 49 — classifyBias", () => {
  it("maps scores to bands deterministically", () => {
    expect(classifyBias(80)).toBe("STRONG_BULLISH");
    expect(classifyBias(60)).toBe("BULLISH");
    expect(classifyBias(50)).toBe("NEUTRAL");
    expect(classifyBias(30)).toBe("BEARISH");
    expect(classifyBias(10)).toBe("STRONG_BEARISH");
  });
});