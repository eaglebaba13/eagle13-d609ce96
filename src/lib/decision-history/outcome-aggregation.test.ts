import { describe, expect, it } from "vitest";
import { buildDecisionPerformanceAnalytics } from "./outcome-aggregation";
import type { DecisionOutcomeRecord } from "./types";

function outcome(over: Partial<DecisionOutcomeRecord> = {}): DecisionOutcomeRecord {
  return {
    runId: over.runId ?? "run-1",
    instrument: over.instrument ?? "NIFTY",
    decision: over.decision ?? "BUY_CE",
    decisionTimestamp: over.decisionTimestamp ?? "2026-08-01T09:15:00.000Z",
    evaluatedAt: over.evaluatedAt ?? "2026-08-01T09:45:00.000Z",
    evaluationHorizon: over.evaluationHorizon ?? "30m",
    entryReferencePrice: over.entryReferencePrice ?? 24000,
    futurePrice: over.futurePrice ?? 24080,
    outcomeState: over.outcomeState ?? "WIN",
    confidence: over.confidence ?? 82,
    formulaVersions: over.formulaVersions ?? { strategy: "decision-performance@1", decision: "decision@1.0.0" },
    providerLabels: over.providerLabels ?? { market: "UPSTOX" },
  };
}

describe("decision performance analytics", () => {
  it("returns NO_DATA for an empty repository", () => {
    const analytics = buildDecisionPerformanceAnalytics([]);
    expect(analytics.status).toBe("NO_DATA");
    expect(analytics.totalEvaluatedRuns).toBe(0);
    expect(analytics.overallWinRatePct).toBeNull();
  });

  it("aggregates evaluated outcomes only and keeps pending/cancelled counts", () => {
    const analytics = buildDecisionPerformanceAnalytics([
      outcome({ runId: "w", outcomeState: "WIN", confidence: 80 }),
      outcome({ runId: "l", outcomeState: "LOSS", confidence: 40 }),
      outcome({ runId: "n", outcomeState: "NEUTRAL", confidence: 60 }),
      outcome({ runId: "p", outcomeState: "PENDING", confidence: 100 }),
      outcome({ runId: "c", outcomeState: "CANCELLED", confidence: 10 }),
    ]);
    expect(analytics.status).toBe("SUPPORTED");
    expect(analytics.totalEvaluatedRuns).toBe(3);
    expect(analytics.pendingRuns).toBe(1);
    expect(analytics.cancelledRuns).toBe(1);
    expect(analytics.overallWinRatePct).toBeCloseTo(33.333, 3);
    expect(analytics.lossRatePct).toBeCloseTo(33.333, 3);
    expect(analytics.neutralRatePct).toBeCloseTo(33.333, 3);
    expect(analytics.averageConfidence).toBe(60);
    expect(analytics.averageEvaluationTimeMs).toBe(30 * 60 * 1000);
  });

  it("groups by instrument, timeframe, strategy, signal direction, and confidence bucket", () => {
    const analytics = buildDecisionPerformanceAnalytics([
      outcome({ runId: "nifty-buy", instrument: "NIFTY", decision: "BUY_CE", evaluationHorizon: "30m", confidence: 20, outcomeState: "WIN", formulaVersions: { strategy: "astro-alpha" } }),
      outcome({ runId: "bank-sell", instrument: "BANKNIFTY", decision: "BUY_PE", evaluationHorizon: "60m", confidence: 55, outcomeState: "LOSS", formulaVersions: { strategy: "astro-beta" } }),
      outcome({ runId: "wait", instrument: "NIFTY", decision: "WAIT", evaluationHorizon: "30m", confidence: 90, outcomeState: "NEUTRAL", formulaVersions: { strategy: "astro-alpha" } }),
    ]);
    expect(analytics.byInstrument.NIFTY.total).toBe(2);
    expect(analytics.byInstrument.BANKNIFTY.losses).toBe(1);
    expect(analytics.byTimeframe["30m"].total).toBe(2);
    expect(analytics.byStrategy["astro-alpha"].total).toBe(2);
    expect(analytics.bySignalDirection.BUY.wins).toBe(1);
    expect(analytics.bySignalDirection.SELL.losses).toBe(1);
    expect(analytics.bySignalDirection.WAIT.neutral).toBe(1);
    expect(analytics.byConfidenceBucket["0-25"].wins).toBe(1);
    expect(analytics.byConfidenceBucket["51-75"].losses).toBe(1);
    expect(analytics.byConfidenceBucket["76-100"].neutral).toBe(1);
  });

  it("is immutable and SSR safe", () => {
    const analytics = buildDecisionPerformanceAnalytics([outcome()]);
    expect(() => {
      (analytics.byInstrument.NIFTY as { total: number }).total = 0;
    }).toThrow();
    expect(typeof window).toBe("undefined");
  });
});
