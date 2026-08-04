import { describe, expect, it } from "vitest";
import { computeGtiAiDecision } from "./engine";
import type { GtiAiDecisionInput, GtiDecisionInput, GtiInstitutionalInput } from "./types";

function baseDec(overrides: Partial<GtiDecisionInput> = {}): GtiDecisionInput {
  return {
    action: "BUY_CE",
    confidence: 80,
    riskLevel: "MEDIUM",
    contributions: [
      { key: "pcr", label: "Combined PCR", bias: "BULL", present: true, note: "PCR 1.12" },
      { key: "breadth", label: "Market Breadth", bias: "BULL", present: true, note: "A/D +200" },
      { key: "sector", label: "Sector Rotation", bias: "BULL", present: true, note: "Bank leads" },
      { key: "vix", label: "India VIX", bias: "BULL", present: true, note: "VIX 12.5" },
      { key: "options", label: "Options", bias: "NEUTRAL", present: true, note: "balanced" },
    ],
    vix: 12.5,
    spot: 22000,
    symbol: "NIFTY",
    generatedAt: new Date().toISOString(),
    marketOpen: true,
    dataFreshnessSec: 15,
    ...overrides,
  };
}

function baseInst(overrides: Partial<GtiInstitutionalInput> = {}): GtiInstitutionalInput {
  return { score: 78, bias: "BULLISH", confidence: 0.85, available: true, ...overrides };
}

describe("computeGtiAiDecision", () => {
  it("maps bullish decision to BUY_CALL when institutional aligns", () => {
    const r = computeGtiAiDecision({ decision: baseDec(), institutional: baseInst() });
    expect(r.action).toBe("BUY_CALL");
    expect(r.confidence).toBeGreaterThan(70);
    expect(r.confidenceBand === "HIGH" || r.confidenceBand === "VERY_HIGH").toBe(true);
    expect(r.tradeQuality === "EXCELLENT" || r.tradeQuality === "GOOD").toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.risk.entryZone).not.toBeNull();
    expect(r.risk.stopLoss).not.toBeNull();
    expect(r.risk.target1).not.toBeNull();
    expect(r.risk.target2).not.toBeNull();
  });

  it("downgrades BUY_CALL to WAIT when institutional is STRONG_BEARISH", () => {
    const r = computeGtiAiDecision({
      decision: baseDec(),
      institutional: baseInst({ score: 15, bias: "STRONG_BEARISH" }),
    });
    expect(r.action).toBe("WAIT");
    expect(r.tradeQuality).toBe("AVOID");
    expect(r.risk.entryZone).toBeNull();
    expect(r.warnings.some((w) => w.includes("opposes"))).toBe(true);
  });

  it("computes BUY_PUT when decision is bearish", () => {
    const r = computeGtiAiDecision({
      decision: baseDec({
        action: "BUY_PE",
        contributions: [
          { key: "pcr", label: "PCR", bias: "BEAR", present: true, note: "PCR 0.7" },
          { key: "breadth", label: "Breadth", bias: "BEAR", present: true, note: "A/D -300" },
        ],
      }),
      institutional: baseInst({ score: 22, bias: "BEARISH" }),
    });
    expect(r.action).toBe("BUY_PUT");
    expect(r.risk.stopLoss).not.toBeNull();
    // For BUY_PUT: stopLoss should be above spot, targets below.
    expect(r.risk.stopLoss!).toBeGreaterThan(22000);
    expect(r.risk.target1!).toBeLessThan(22000);
  });

  it("returns WAIT with unavailable risk plan when decision says WAIT", () => {
    const r = computeGtiAiDecision({
      decision: baseDec({ action: "WAIT", confidence: 30 }),
      institutional: baseInst({ score: 50, bias: "NEUTRAL" }),
    });
    expect(r.action).toBe("WAIT");
    expect(r.risk.entryZone).toBeNull();
    expect(r.risk.unavailableReason).toBeTruthy();
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("marks risk plan unavailable when spot is missing", () => {
    const r = computeGtiAiDecision({
      decision: baseDec({ spot: null }),
      institutional: baseInst(),
    });
    expect(r.action).toBe("BUY_CALL");
    expect(r.risk.entryZone).toBeNull();
    expect(r.risk.unavailableReason).toContain("Spot price unavailable");
  });

  it("tracks decision timeline changes vs previous", () => {
    const r = computeGtiAiDecision({
      decision: baseDec(),
      institutional: baseInst(),
      optional: { previous: { action: "WAIT", generatedAt: "2026-01-01T00:00:00Z" } },
    });
    expect(r.timeline.previousAction).toBe("WAIT");
    expect(r.timeline.currentAction).toBe("BUY_CALL");
    expect(r.timeline.decisionChanged).toBe(true);
  });

  it("never fabricates: institutional unavailable emits warning and uses base confidence", () => {
    const r = computeGtiAiDecision({
      decision: baseDec(),
      institutional: { score: 50, bias: "NEUTRAL", confidence: 0, available: false },
    });
    expect(r.warnings.some((w) => w.includes("Institutional"))).toBe(true);
    expect(r.confidence).toBeLessThanOrEqual(80);
  });
});