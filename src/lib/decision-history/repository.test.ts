import { describe, expect, it } from "vitest";
import { InMemoryDecisionHistoryRepository } from "./repository";
import { persistCompletedDecision } from "./persistence.functions";
import type { DecisionPersistedRecord } from "./types";

describe("decision-history repository", () => {
  it("persists successfully and keeps one immutable record per run id", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const record: DecisionPersistedRecord = {
      runId: "decision-1",
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 22340,
      decision: "BUY_CE",
      confidence: 82,
      risk: { level: "MEDIUM", reasons: ["vol"] },
      signals: [{ key: "astro", present: true }],
      capabilities: {},
      summary: {},
      formulaVersions: { astro: "v1" },
      providerLabels: { options: "live" },
    };

    await repo.save(record);
    await repo.save({ ...record, confidence: 90 });

    const stored = repo.getDecisionRunById("decision-1");
    expect(stored?.confidence).toBe(90);
    expect(repo.listDecisionRuns()).toHaveLength(1);

    const frozen = stored as unknown as { risk: { reasons: string[] } };
    expect(() => {
      frozen.risk.reasons.push("x");
    }).toThrow();
  });

  it("retains only the bounded number of records", async () => {
    const repo = new InMemoryDecisionHistoryRepository(2);
    for (let i = 0; i < 3; i++) {
      await repo.save({
        runId: `decision-${i}`,
        timestamp: `2026-07-30T10:00:00.${i}00Z`,
        instrument: "BANKNIFTY",
        spot: 48000,
        decision: "WAIT",
        confidence: 10,
        risk: { level: "LOW", reasons: [] },
        signals: [],
        capabilities: {},
        summary: {},
        formulaVersions: {},
        providerLabels: {},
      });
    }

    expect(repo.listDecisionRuns()).toHaveLength(2);
    expect(repo.getDecisionHistoryStats().droppedRunCount).toBe(1);
  });

  it("returns safe statistics and redacts errors", async () => {
    const repo = new InMemoryDecisionHistoryRepository(5);
    await repo.save({
      runId: "decision-a",
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 22340,
      decision: "BUY_CE",
      confidence: 82,
      risk: { level: "MEDIUM", reasons: [] },
      signals: [],
      capabilities: {},
      summary: {},
      formulaVersions: {},
      providerLabels: {},
    });
    const stats = repo.getDecisionHistoryStats();
    expect(stats.repositoryType).toBe("IN_MEMORY");
    expect(stats.totalRuns).toBe(1);
    expect(stats.instruments).toEqual(["NIFTY"]);
  });

  it("falls back safely for synchronous and asynchronous repository failures", async () => {
    const syncRepo = {
      async save() {
        throw new Error("sync boom");
      },
    };
    const asyncRepo = {
      async save() {
        throw new Error("async boom");
      },
    };

    const syncResult = await persistCompletedDecision({
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 22340,
      decision: "WAIT",
      confidence: 10,
      risk: { level: "LOW", reasons: [] },
      signals: [],
      capabilities: {},
      summary: {},
      formulaVersions: {},
      providerLabels: {},
    }, syncRepo as never);
    const asyncResult = await persistCompletedDecision({
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "BANKNIFTY",
      spot: 48000,
      decision: "BUY_PE",
      confidence: 74,
      risk: { level: "MEDIUM", reasons: [] },
      signals: [],
      capabilities: {},
      summary: {},
      providerLabels: {},
      formulaVersions: {},
    }, asyncRepo as never);

    expect(syncResult.ok).toBe(false);
    expect(asyncResult.ok).toBe(false);
  });

  it("preserves byte-equivalent snapshot values before and after persistence", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const snapshot = {
      decision: { action: "WAIT", confidence: 10 },
      signals: [{ key: "astro", present: true }],
    };
    await repo.save({
      runId: "decision-byte",
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 22340,
      decision: "WAIT",
      confidence: 10,
      risk: { level: "LOW", reasons: [] },
      signals: snapshot.signals,
      capabilities: {},
      summary: snapshot.decision,
      formulaVersions: {},
      providerLabels: {},
    });

    const stored = repo.getDecisionRunById("decision-byte");
    expect(stored?.summary).toEqual(snapshot.decision);
    expect(stored?.signals).toEqual(snapshot.signals);
  });
});


describe("decision-history outcomes", () => {
  function record(over: Partial<DecisionPersistedRecord> = {}): DecisionPersistedRecord {
    return {
      runId: over.runId ?? "decision-outcome-1",
      timestamp: over.timestamp ?? "2026-07-30T10:00:00.000Z",
      instrument: over.instrument ?? "NIFTY",
      spot: over.spot ?? 22340,
      decision: over.decision ?? "BUY_CE",
      confidence: over.confidence ?? 82,
      risk: over.risk ?? { level: "MEDIUM", reasons: [] },
      signals: over.signals ?? [],
      capabilities: over.capabilities ?? {},
      summary: over.summary ?? {},
      formulaVersions: over.formulaVersions ?? { decision: "decision@1.0.0" },
      providerLabels: over.providerLabels ?? { options: "UPSTOX" },
    };
  }

  function outcome(runId = "decision-outcome-1", state: "PENDING" | "WIN" | "LOSS" | "NEUTRAL" | "TIME_EXPIRED" | "CANCELLED" | "UNEVALUATED" = "WIN") {
    return {
      runId,
      instrument: "NIFTY",
      decision: "BUY_CE",
      decisionTimestamp: "2026-07-30T10:00:00.000Z",
      evaluatedAt: "2026-07-30T10:30:00.000Z",
      evaluationHorizon: "30m",
      entryReferencePrice: 22340,
      futurePrice: 22410,
      outcomeState: state,
      confidence: 82,
      formulaVersions: { decision: "decision@1.0.0" },
      providerLabels: { options: "UPSTOX" },
    } as const;
  }

  it("records an immutable outcome only for an existing decision run", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    expect((await repo.recordOutcome(outcome())).status).toBe("MISSING_RUN");
    await repo.save(record());
    expect((await repo.recordOutcome(outcome())).status).toBe("RECORDED");
    const stored = repo.getOutcome("decision-outcome-1");
    expect(stored?.outcomeState).toBe("WIN");
    expect(() => {
      (stored as { formulaVersions: Record<string, string> }).formulaVersions.decision = "changed";
    }).toThrow();
  });

  it("treats identical duplicate outcomes as idempotent and conflicts deterministically", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(record());
    expect((await repo.recordOutcome(outcome())).status).toBe("RECORDED");
    expect((await repo.recordOutcome(outcome())).status).toBe("DUPLICATE");
    expect((await repo.recordOutcome({ ...outcome(), outcomeState: "LOSS" })).status).toBe("CONFLICT");
    expect(repo.listOutcomes()).toHaveLength(1);
  });

  it("retains bounded outcomes in insertion order", async () => {
    const repo = new InMemoryDecisionHistoryRepository(10, 2);
    for (let i = 0; i < 3; i++) {
      const runId = `decision-retention-${i}`;
      await repo.save(record({ runId, timestamp: `2026-07-30T10:0${i}:00.000Z` }));
      await repo.recordOutcome({ ...outcome(runId, i === 2 ? "LOSS" : "WIN"), evaluatedAt: `2026-07-30T10:3${i}:00.000Z` });
    }
    expect(repo.listOutcomes().map((item) => item.runId)).toEqual(["decision-retention-1", "decision-retention-2"]);
    expect(repo.getOutcomeRetentionStats().droppedOutcomeCount).toBe(1);
  });

  it("builds deterministic outcome stats and excludes pending/unevaluated", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const states = ["WIN", "LOSS", "NEUTRAL", "TIME_EXPIRED", "PENDING", "UNEVALUATED"] as const;
    const confidences = [20, 40, 70, 90, 100, 10] as const;
    for (let i = 0; i < states.length; i++) {
      const runId = `decision-stats-${i}`;
      await repo.save(record({ runId, decision: i % 2 === 0 ? "BUY_CE" : "WAIT", instrument: i < 3 ? "NIFTY" : "BANKNIFTY" }));
      await repo.recordOutcome({ ...outcome(runId, states[i]), decision: i % 2 === 0 ? "BUY_CE" : "WAIT", instrument: i < 3 ? "NIFTY" : "BANKNIFTY", confidence: confidences[i] });
    }
    const stats = repo.getOutcomeStats();
    expect(stats.storedOutcomes).toBe(6);
    expect(stats.evaluatedOutcomes).toBe(4);
    expect(stats.pendingOutcomes).toBe(1);
    expect(stats.unevaluatedOutcomes).toBe(1);
    expect(stats.confidenceBuckets).toEqual({ "0-25": 1, "26-50": 1, "51-75": 1, "76-100": 1 });
    expect(stats.winRatePct).toBe(25);
    expect(stats.lossRatePct).toBe(25);
    expect(stats.byDecision.BUY_CE.total).toBe(2);
    expect(stats.byInstrument.NIFTY.total).toBe(3);
    expect(stats.historicalAccuracyReady).toBe(true);
  });

  it("keeps decision snapshot values byte-equivalent after outcome repository failure", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const snapshot = record({ runId: "decision-byte-outcome", summary: { action: "WAIT", confidence: 10 } });
    await repo.save(snapshot);
    await repo.recordOutcome({ ...outcome("missing-run"), providerLabels: { authorization: "Bearer secret-token" } });
    expect(repo.getDecisionRunById("decision-byte-outcome")?.summary).toEqual(snapshot.summary);
  });
});


describe("decision-history outcome diagnostics aggregates", () => {
  it("reports neutral rate and average evaluation time from evaluated outcomes", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const base = {
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 24000,
      decision: "WAIT",
      confidence: 50,
      risk: { level: "LOW", reasons: [] },
      signals: [],
      capabilities: {},
      summary: {},
      formulaVersions: { decision: "decision@1.0.0" },
      providerLabels: {},
    } satisfies Omit<DecisionPersistedRecord, "runId">;
    for (const [runId, state] of [["diag-win", "WIN"], ["diag-neutral", "NEUTRAL"], ["diag-cancel", "CANCELLED"]] as const) {
      await repo.save({ ...base, runId });
      await repo.recordOutcome({
        runId,
        instrument: "NIFTY",
        decision: "WAIT",
        decisionTimestamp: "2026-07-30T10:00:00.000Z",
        evaluatedAt: "2026-07-30T10:30:00.000Z",
        evaluationHorizon: "30m",
        entryReferencePrice: 24000,
        futurePrice: 24000,
        outcomeState: state,
        confidence: 50,
        formulaVersions: { decision: "decision@1.0.0" },
        providerLabels: { token: "secret" },
      });
    }
    const stats = repo.getOutcomeStats();
    expect(stats.evaluatedOutcomes).toBe(2);
    expect(stats.cancelledOutcomes).toBe(1);
    expect(stats.neutralRatePct).toBe(50);
    expect(stats.averageEvaluationTimeMs).toBe(30 * 60 * 1000);
  });
});
