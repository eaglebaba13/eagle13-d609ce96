import { describe, expect, it } from "vitest";
import { selectHistoricalAccuracyFromOutcomes } from "@/lib/decision/historical-accuracy-adapter";
import { replayUnavailableFromDecisionHistory } from "@/lib/decision/replay-adapter";
import { defaultLifecycleExecutionRepository, InMemoryLifecycleExecutionRepository, type LifecycleExecutionSummary } from "./lifecycle-execution-history";
import { getLifecycleRuntimeState, resetLifecycleRunnerForTests, runScheduledEvaluationLifecycle, runSnapshotIngestionRunner } from "./lifecycle-runner.server";
import { classifyLifecycleSchedulerRuntime, computeLifecycleRetryBackoffMs, evaluateSchedulerMarketSession, getLifecycleSchedulerRegistrationStatus, registerDecisionOutcomeLifecycleScheduler, resetLifecycleSchedulerRegistrationForTests, runManualDecisionOutcomeLifecycle, runRegisteredDecisionOutcomeLifecycle, shouldRetryLifecycleFailure } from "./lifecycle-registration.server";
import { InMemoryDecisionHistoryRepository } from "./repository";
import type { DecisionPersistedRecord } from "./types";
import type { UpstoxIndexQuoteResult, UpstoxIndexSymbol } from "@/lib/upstox-market-data.server";

const NOW = "2026-07-30T09:45:00.000Z";

function quote(symbol: UpstoxIndexSymbol, price = 24080, marketState: "OPEN" | "CLOSED" = "OPEN"): UpstoxIndexQuoteResult {
  return {
    ok: true,
    quote: {
      symbol,
      name: symbol,
      livePrice: price,
      prevSessionClose: price - 10,
      change: 10,
      changePct: 0.04,
      marketState,
      prevDay: { open: price - 20, high: price, low: price - 30, close: price - 10, date: "2026-07-29" },
      updatedAt: NOW,
    },
    providerMetadata: { name: "upstox-historical-v1", status: "LIVE", receivedAt: NOW, providerTime: NOW },
  };
}

function decision(over: Partial<DecisionPersistedRecord> = {}): DecisionPersistedRecord {
  return {
    runId: over.runId ?? "lifecycle-run-1",
    timestamp: over.timestamp ?? "2026-07-30T09:15:00.000Z",
    instrument: over.instrument ?? "NIFTY50",
    spot: over.spot ?? 24000,
    decision: over.decision ?? "BUY_CE",
    confidence: over.confidence ?? 80,
    risk: over.risk ?? { level: "MEDIUM", reasons: [] },
    signals: over.signals ?? [],
    capabilities: over.capabilities ?? {},
    summary: over.summary ?? { evaluationHorizon: "30m" },
    formulaVersions: over.formulaVersions ?? { decision: "decision@1.0.0" },
    providerLabels: over.providerLabels ?? {},
  };
}

describe("snapshot ingestion lifecycle runner", () => {
  it("ingests existing normalized market outputs safely", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const summary = await runSnapshotIngestionRunner({
      repository: repo,
      instruments: ["NIFTY50"],
      nowIso: NOW,
      fetchQuote: async (symbol) => quote(symbol),
    });
    expect(summary.attempted).toBe(1);
    expect(summary.stored).toBe(1);
    expect(repo.getMarketSnapshotStats().verifiedMarketSnapshots).toBe(1);
    expect(JSON.stringify(summary)).not.toMatch(/token|secret|authorization|raw|body/i);
  });

  it("classifies provider unavailable and snapshot rejected without raw leakage", async () => {
    const unavailable = await runSnapshotIngestionRunner({
      instruments: ["NIFTY50"],
      nowIso: NOW,
      fetchQuote: async () => ({ ok: false, reason: "UNKNOWN", detail: "Bearer secret token" }),
    });
    expect(unavailable.unavailable).toBe(1);
    expect(JSON.stringify(unavailable)).not.toMatch(/Bearer|secret|token/i);

    const rejected = await runSnapshotIngestionRunner({
      instruments: ["NIFTY50"],
      nowIso: NOW,
      fetchQuote: async (symbol) => quote(symbol, -1),
    });
    expect(rejected.rejected).toBe(1);
  });

  it("returns no attempted work when existing market state is closed", async () => {
    const summary = await runSnapshotIngestionRunner({
      instruments: ["NIFTY50"],
      nowIso: NOW,
      fetchQuote: async (symbol) => quote(symbol, 24000, "CLOSED"),
    });
    expect(summary.attempted).toBe(0);
    expect(summary.safeWarnings).toContain("NIFTY50: MARKET_CLOSED");
  });
});

describe("scheduled evaluation lifecycle runner", () => {
  it("runs ingestion then scheduler and persists an evaluated outcome", async () => {
    resetLifecycleRunnerForTests();
    defaultLifecycleExecutionRepository.resetExecutionsForTests();
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(decision());
    const result = await runScheduledEvaluationLifecycle({
      repository: repo,
      schedulerRepository: repo,
      instruments: ["NIFTY50"],
      nowIso: NOW,
      fetchQuote: async (symbol) => quote(symbol),
    });
    expect(result.status).toBe("SUCCESS");
    expect(result.snapshotsStored).toBe(1);
    expect(result.evaluatedRuns).toBe(1);
    expect(repo.getOutcome("lifecycle-run-1")?.outcomeState).toBe("WIN");
  });

  it("returns NO_WORK when closed market keeps eligible runs pending", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(decision());
    const result = await runScheduledEvaluationLifecycle({
      repository: repo,
      schedulerRepository: repo,
      instruments: ["NIFTY50"],
      nowIso: NOW,
      fetchQuote: async (symbol) => quote(symbol, 24000, "CLOSED"),
      recordExecution: false,
    });
    expect(result.status).toBe("NO_WORK");
    expect(result.pendingRuns).toBe(1);
    expect(repo.getOutcome("lifecycle-run-1")).toBeNull();
  });

  it("keeps existing outcomes skipped and idempotent on repeated execution", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(decision());
    const opts = { repository: repo, schedulerRepository: repo, instruments: ["NIFTY50"] as const, nowIso: NOW, fetchQuote: async (symbol: UpstoxIndexSymbol) => quote(symbol), recordExecution: false };
    expect((await runScheduledEvaluationLifecycle(opts)).evaluatedRuns).toBe(1);
    const second = await runScheduledEvaluationLifecycle(opts);
    expect(second.evaluatedRuns).toBe(0);
    expect(second.skippedRuns).toBeGreaterThan(0);
    expect(repo.listOutcomes()).toHaveLength(1);
  });

  it("prevents overlapping runs", async () => {
    resetLifecycleRunnerForTests();
    const repo = new InMemoryDecisionHistoryRepository();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const first = runScheduledEvaluationLifecycle({ repository: repo, schedulerRepository: repo, instruments: ["NIFTY50"], nowIso: NOW, fetchQuote: async () => { await pending; return quote("NIFTY50"); }, recordExecution: false });
    const second = await runScheduledEvaluationLifecycle({ repository: repo, schedulerRepository: repo, instruments: ["NIFTY50"], nowIso: NOW, fetchQuote: async () => quote("NIFTY50"), recordExecution: false });
    expect(second.status).toBe("FAILED");
    expect(second.safeWarnings).toContain("SCHEDULER_BUSY");
    release();
    await first;
    expect(getLifecycleRuntimeState().retryCount).toBe(1);
  });

  it("keeps replay unchanged and historical accuracy NO_DATA without outcomes", () => {
    expect(replayUnavailableFromDecisionHistory(1).capability).toBe("NO_DATA");
    expect(
      selectHistoricalAccuracyFromOutcomes([], {
        instrument: "NIFTY50",
        strategyVersion: "strategy@1.0.0",
        formulaVersion: "decision@1.0.0",
        now: new Date(0).toISOString(),
      }).capability,
    ).toBe("NO_DATA");
  });
});

describe("execution history and registration", () => {
  function summary(id: string): LifecycleExecutionSummary {
    return {
      executionId: id,
      startedAt: NOW,
      completedAt: NOW,
      durationMs: 0,
      snapshotsAttempted: 0,
      snapshotsStored: 0,
      eligibleRuns: 0,
      evaluatedRuns: 0,
      skippedRuns: 0,
      pendingRuns: 0,
      failedRuns: 0,
      status: "NO_WORK",
      safeWarnings: ["secret token warning"],
    };
  }

  it("retains bounded immutable execution history with sanitized warnings", () => {
    const repo = new InMemoryLifecycleExecutionRepository(2);
    repo.recordExecution(summary("a"));
    repo.recordExecution(summary("b"));
    repo.recordExecution(summary("c"));
    expect(repo.listExecutions(10).map((item) => item.executionId)).toEqual(["b", "c"]);
    const last = repo.getLastExecution();
    expect(last?.safeWarnings[0]).not.toMatch(/secret|token/i);
    expect(() => {
      (last as { durationMs: number }).durationMs = 1;
    }).toThrow();
  });


  it("classifies runtime capability honestly", () => {
    expect(classifyLifecycleSchedulerRuntime()).toBe("MANUAL_ONLY");
    expect(classifyLifecycleSchedulerRuntime({ runtime: "CLOUDFLARE_SCHEDULED" })).toBe("CLOUDFLARE_SCHEDULED");
    expect(classifyLifecycleSchedulerRuntime({ bindingDetected: true })).toBe("EXTERNAL_HTTP_CRON");
  });

  it("registers only when a verified scheduler binding and durable persistence are ready", () => {
    resetLifecycleSchedulerRegistrationForTests();
    const inactive = registerDecisionOutcomeLifecycleScheduler({ force: true, persistenceReady: true, enabled: true });
    expect(inactive.status).toBe("INACTIVE_MANUAL_ONLY");
    expect(inactive.automaticEvaluationActive).toBe(false);
    expect(inactive.activationBlockers).toContain("SCHEDULER_BINDING_NOT_DETECTED");

    resetLifecycleSchedulerRegistrationForTests();
    const active = registerDecisionOutcomeLifecycleScheduler({
      force: true,
      runtime: "EXTERNAL_HTTP_CRON",
      bindingDetected: true,
      enabled: true,
      persistenceReady: true,
      lifecycleRunnerCallable: true,
      nowIso: NOW,
    });
    expect(active.status).toBe("REGISTERED");
    expect(active.automaticEvaluationActive).toBe(true);
    expect(active.nextExpectedExecution).toBe("2026-07-30T09:50:00.000Z");
    expect(getLifecycleSchedulerRegistrationStatus({ persistenceReady: true }).automaticEvaluationActive).toBe(true);
  });

  it("fails closed for persistence and invalid configuration blockers", () => {
    resetLifecycleSchedulerRegistrationForTests();
    const persistenceBlocked = registerDecisionOutcomeLifecycleScheduler({
      force: true,
      runtime: "EXTERNAL_HTTP_CRON",
      bindingDetected: true,
      enabled: true,
      persistenceReady: false,
    });
    expect(persistenceBlocked.status).toBe("BLOCKED_PERSISTENCE");
    expect(persistenceBlocked.automaticEvaluationActive).toBe(false);

    resetLifecycleSchedulerRegistrationForTests();
    const invalid = registerDecisionOutcomeLifecycleScheduler({ force: true, intervalMs: 1, persistenceReady: true, enabled: true, bindingDetected: true });
    expect(invalid.status).toBe("INVALID_CONFIGURATION");
    expect(invalid.activationBlockers).toContain("INVALID_CONFIGURATION");
  });

  it("does not duplicate registration during hot reload", () => {
    resetLifecycleSchedulerRegistrationForTests();
    const first = registerDecisionOutcomeLifecycleScheduler({ force: true, runtime: "EXTERNAL_HTTP_CRON", bindingDetected: true, enabled: true, persistenceReady: true, nowIso: NOW });
    const second = registerDecisionOutcomeLifecycleScheduler({ force: true, runtime: "EXTERNAL_HTTP_CRON", bindingDetected: true, enabled: true, persistenceReady: true, nowIso: "2026-07-30T10:00:00.000Z" });
    expect(second).toBe(first);
  });

  it("gates scheduled execution on deterministic weekday session policy", async () => {
    resetLifecycleSchedulerRegistrationForTests();
    expect(evaluateSchedulerMarketSession("2026-08-01T10:00:00.000Z")).toEqual({ status: "MARKET_CLOSED", reason: "WEEKEND" });
    expect(evaluateSchedulerMarketSession("2026-07-30T02:00:00.000Z").status).toBe("MARKET_CLOSED");
    expect(evaluateSchedulerMarketSession(NOW).status).toBe("OPEN");

    const closed = await runRegisteredDecisionOutcomeLifecycle({
      nowIso: "2026-08-01T10:00:00.000Z",
      registration: { force: true, runtime: "EXTERNAL_HTTP_CRON", bindingDetected: true, enabled: true, persistenceReady: true },
      recordExecution: false,
    });
    expect(closed.status).toBe("NO_WORK");
    expect(closed.safeWarnings).toContain("WEEKEND");
  });

  it("uses bounded retry policy only for transient failures", () => {
    expect(shouldRetryLifecycleFailure("PROVIDER_UNAVAILABLE")).toBe(true);
    expect(shouldRetryLifecycleFailure("temporary network error")).toBe(true);
    expect(shouldRetryLifecycleFailure("MARKET_CLOSED")).toBe(false);
    expect(shouldRetryLifecycleFailure("SNAPSHOT_REJECTED")).toBe(false);
    expect(computeLifecycleRetryBackoffMs(0, 1000)).toBe(1000);
    expect(computeLifecycleRetryBackoffMs(3, 1000)).toBe(8000);
    expect(computeLifecycleRetryBackoffMs(20, 1000)).toBeLessThanOrEqual(60000);
  });

  it("manual lifecycle execution is labelled manual and never activates scheduler readiness", async () => {
    resetLifecycleSchedulerRegistrationForTests();
    const repo = new InMemoryDecisionHistoryRepository();
    const result = await runManualDecisionOutcomeLifecycle({ repository: repo, schedulerRepository: repo, instruments: [], nowIso: NOW, recordExecution: false });
    expect(result.executionId).toBe(`manual-decision-lifecycle::${NOW}`);
    expect(getLifecycleSchedulerRegistrationStatus().automaticEvaluationActive).toBe(false);
  });

  it("redacts scheduler activation diagnostics", () => {
    resetLifecycleSchedulerRegistrationForTests();
    const status = registerDecisionOutcomeLifecycleScheduler({
      force: true,
      runtime: "EXTERNAL_HTTP_CRON",
      bindingDetected: false,
      enabled: true,
      persistenceReady: true,
      scheduleIdentifier: "Bearer secret token schedule",
    });
    expect(JSON.stringify(status)).not.toMatch(/Bearer|secret|token/i);
  });

  it("reports scheduler registration disabled/inactive without client timers", () => {
    resetLifecycleSchedulerRegistrationForTests();
    const status = registerDecisionOutcomeLifecycleScheduler();
    expect(["DISABLED_IN_TEST", "INACTIVE_UNSUPPORTED_RUNTIME"]).toContain(status.status);
    expect(status.automaticEvaluationActive).toBe(false);
    expect(getLifecycleSchedulerRegistrationStatus().automaticEvaluationActive).toBe(false);
    expect(typeof window).toBe("undefined");
  });
});

