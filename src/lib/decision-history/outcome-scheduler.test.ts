import { describe, expect, it } from "vitest";
import { InMemoryDecisionHistoryRepository } from "./repository";
import {
  getOutcomeSchedulerDiagnostics,
  resetOutcomeSchedulerForTests,
  resolveDecisionEvaluationHorizon,
  runOutcomeScheduler,
  type VerifiedMarketSnapshotLoader,
} from "./outcome-scheduler";
import type { DecisionPersistedRecord } from "./types";

function run(over: Partial<DecisionPersistedRecord> = {}): DecisionPersistedRecord {
  return {
    runId: over.runId ?? "scheduler-run-1",
    timestamp: over.timestamp ?? "2026-07-30T09:15:00.000Z",
    instrument: over.instrument ?? "NIFTY",
    spot: over.spot ?? 24000,
    decision: over.decision ?? "BUY_CE",
    confidence: over.confidence ?? 80,
    risk: over.risk ?? { level: "MEDIUM", reasons: [] },
    signals: over.signals ?? [],
    capabilities: over.capabilities ?? {},
    summary: over.summary ?? { evaluationHorizon: "30m" },
    formulaVersions: over.formulaVersions ?? { decision: "decision@1.0.0" },
    providerLabels: over.providerLabels ?? { market: "UPSTOX" },
  };
}

describe("outcome scheduler", () => {
  it("queues expired pending runs and persists evaluated outcomes from verified snapshots", async () => {
    resetOutcomeSchedulerForTests();
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(run());
    const loader: VerifiedMarketSnapshotLoader = ({ run: item, horizon }) => ({
      instrument: item.instrument,
      timestamp: horizon.expiresAt,
      price: 24080,
      providerLabels: { verifiedSnapshot: "persisted" },
    });

    const result = await runOutcomeScheduler({
      repository: repo,
      loadVerifiedSnapshot: loader,
      evaluatedAt: "2026-07-30T09:45:00.000Z",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.evaluatedQueue).toBe(1);
    expect(repo.getOutcome("scheduler-run-1")?.outcomeState).toBe("WIN");
    expect(repo.getOutcomeStats().evaluatedOutcomes).toBe(1);
  });

  it("skips non-expired horizons without loading snapshots", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(run());
    let called = false;
    const result = await runOutcomeScheduler({
      repository: repo,
      loadVerifiedSnapshot: () => {
        called = true;
        return null;
      },
      evaluatedAt: "2026-07-30T09:30:00.000Z",
    });

    expect(called).toBe(false);
    expect(result.pendingQueue).toBe(1);
    expect(result.items[0]?.status).toBe("SKIPPED_HORIZON_PENDING");
    expect(repo.getOutcome("scheduler-run-1")).toBeNull();
  });

  it("keeps expired runs pending when verified snapshots are missing", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(run());
    const result = await runOutcomeScheduler({
      repository: repo,
      loadVerifiedSnapshot: () => null,
      evaluatedAt: "2026-07-30T09:45:00.000Z",
    });

    expect(result.pendingQueue).toBe(1);
    expect(result.items[0]?.status).toBe("SKIPPED_MISSING_SNAPSHOT");
    expect(repo.getOutcome("scheduler-run-1")).toBeNull();
  });

  it("keeps provider failures retryable and does not persist outcomes", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(run());
    const result = await runOutcomeScheduler({
      repository: repo,
      loadVerifiedSnapshot: () => {
        throw new Error("provider unavailable");
      },
      evaluatedAt: "2026-07-30T09:45:00.000Z",
    });

    expect(result.pendingQueue).toBe(1);
    expect(result.items[0]?.status).toBe("SKIPPED_PROVIDER_FAILURE");
    expect(repo.getOutcome("scheduler-run-1")).toBeNull();
  });

  it("is idempotent and skips already evaluated runs", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(run());
    const options = {
      repository: repo,
      loadVerifiedSnapshot: () => ({
        instrument: "NIFTY",
        timestamp: "2026-07-30T09:45:00.000Z",
        price: 24080,
      }),
      evaluatedAt: "2026-07-30T09:45:00.000Z",
    } as const;

    expect((await runOutcomeScheduler(options)).evaluatedQueue).toBe(1);
    const second = await runOutcomeScheduler(options);
    expect(second.evaluatedQueue).toBe(0);
    expect(second.items[0]?.status).toBe("SKIPPED_ALREADY_EVALUATED");
    expect(repo.listOutcomes()).toHaveLength(1);
  });

  it("reports repository unavailable safely", async () => {
    const result = await runOutcomeScheduler({
      repository: {},
      loadVerifiedSnapshot: () => null,
      evaluatedAt: "2026-07-30T09:45:00.000Z",
    });

    expect(result.status).toBe("FAILED");
    expect(result.repositoryHealth).toBe("UNAVAILABLE");
  });

  it("exposes immutable SSR-safe diagnostics", async () => {
    resetOutcomeSchedulerForTests();
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(run());
    await runOutcomeScheduler({
      repository: repo,
      loadVerifiedSnapshot: () => ({
        instrument: "NIFTY",
        timestamp: "2026-07-30T09:45:00.000Z",
        price: 24080,
      }),
      evaluatedAt: "2026-07-30T09:45:00.000Z",
    });

    const diagnostics = getOutcomeSchedulerDiagnostics();
    expect(diagnostics.schedulerStatus).toBe("COMPLETED");
    expect(typeof window).toBe("undefined");
    expect(() => {
      (diagnostics as { pendingQueue: number }).pendingQueue = 99;
    }).toThrow();
  });

  it("resolves deterministic horizons from persisted run summary", () => {
    const horizon = resolveDecisionEvaluationHorizon(run({ summary: { evaluationHorizon: "60m" } }), "2026-07-30T10:15:00.000Z");
    expect(horizon).toEqual({
      label: "60m",
      expiresAt: "2026-07-30T10:15:00.000Z",
      evaluatedAt: "2026-07-30T10:15:00.000Z",
    });
  });
});
