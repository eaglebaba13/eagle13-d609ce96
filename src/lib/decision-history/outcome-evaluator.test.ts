import { describe, expect, it } from "vitest";
import { InMemoryDecisionHistoryRepository } from "./repository";
import { evaluateDecisionOutcome, evaluateOutcomeRecord, type EvaluationHorizon, type FutureMarketSnapshot } from "./outcome-evaluator";
import type { DecisionPersistedRecord } from "./types";

const RUN: DecisionPersistedRecord = {
  runId: "decision-eval-1",
  timestamp: "2026-07-30T09:15:00.000Z",
  instrument: "NIFTY",
  spot: 24000,
  decision: "BUY_CE",
  confidence: 80,
  risk: { level: "MEDIUM", reasons: [] },
  signals: [],
  capabilities: {},
  summary: {},
  formulaVersions: { decision: "decision@1.0.0" },
  providerLabels: { market: "UPSTOX" },
};

const EXPIRED: EvaluationHorizon = {
  label: "30m",
  expiresAt: "2026-07-30T09:45:00.000Z",
  evaluatedAt: "2026-07-30T09:45:00.000Z",
};

const SNAPSHOT: FutureMarketSnapshot = {
  instrument: "NIFTY",
  timestamp: "2026-07-30T09:45:00.000Z",
  price: 24080,
  providerLabels: { marketEvaluation: "UPSTOX" },
};

describe("outcome evaluator", () => {
  it("evaluates bullish decisions deterministically after horizon expiry", () => {
    const result = evaluateOutcomeRecord(RUN, SNAPSHOT, EXPIRED);
    expect(result.outcome.outcomeState).toBe("WIN");
    expect(result.outcome.entryReferencePrice).toBe(24000);
    expect(result.outcome.futurePrice).toBe(24080);
    expect(result.reason).toBe("BULLISH_PRICE_UP");
  });

  it("evaluates bearish decisions deterministically", () => {
    const result = evaluateOutcomeRecord({ ...RUN, decision: "BUY_PE" }, { ...SNAPSHOT, price: 23950 }, EXPIRED);
    expect(result.outcome.outcomeState).toBe("WIN");
    expect(result.reason).toBe("BEARISH_PRICE_DOWN");
  });

  it("does not evaluate before the horizon expires", () => {
    const result = evaluateOutcomeRecord(RUN, SNAPSHOT, {
      ...EXPIRED,
      evaluatedAt: "2026-07-30T09:30:00.000Z",
    });
    expect(result.outcome.outcomeState).toBe("UNEVALUATED");
    expect(result.reason).toBe("HORIZON_PENDING");
  });

  it("does not fabricate missing future data", () => {
    const result = evaluateOutcomeRecord(RUN, { ...SNAPSHOT, price: null }, EXPIRED);
    expect(result.outcome.outcomeState).toBe("UNEVALUATED");
    expect(result.outcome.futurePrice).toBeNull();
    expect(result.reason).toBe("MISSING_FUTURE_DATA");
  });

  it("loads, evaluates, and persists through the repository pipeline", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(RUN);
    const result = await evaluateDecisionOutcome(repo, RUN.runId, SNAPSHOT, EXPIRED);
    expect(result.ok).toBe(true);
    expect(result.write?.status).toBe("RECORDED");
    expect(repo.getOutcome(RUN.runId)?.outcomeState).toBe("WIN");
  });

  it("keeps duplicate outcome writes idempotent", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(RUN);
    expect((await evaluateDecisionOutcome(repo, RUN.runId, SNAPSHOT, EXPIRED)).write?.status).toBe("RECORDED");
    expect((await evaluateDecisionOutcome(repo, RUN.runId, SNAPSHOT, EXPIRED)).write?.status).toBe("DUPLICATE");
  });

  it("returns UNEVALUATED without persisting when future data is unavailable", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(RUN);
    const result = await evaluateDecisionOutcome(repo, RUN.runId, null, EXPIRED);
    expect(result.ok).toBe(false);
    expect(result.outcome?.outcomeState).toBe("UNEVALUATED");
    expect(repo.getOutcome(RUN.runId)).toBeNull();
  });

  it("fails safely when the decision run is missing", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const result = await evaluateDecisionOutcome(repo, "missing", SNAPSHOT, EXPIRED);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });
});
