import { recordEvent } from "@/lib/observability";
import { StructuredLogger, newCorrelationId } from "@/lib/structured-logging";
import { fetchUpstoxIndexQuote, type UpstoxIndexQuoteResult, type UpstoxIndexSymbol } from "@/lib/upstox-market-data.server";
import { ingestVerifiedMarketSnapshot, normalizedInputFromIndexQuote } from "./market-snapshot-ingestion.server";
import { runOutcomeScheduler, type OutcomeSchedulerRunResult } from "./outcome-scheduler";
import { defaultDecisionHistoryRepository } from "./repository";
import {
  defaultLifecycleExecutionRepository,
  type LifecycleExecutionStatus,
  type LifecycleExecutionSummary,
} from "./lifecycle-execution-history";
import type { DecisionPersistenceRepository, DecisionMarketSnapshotWriteResult } from "./types";

export type SnapshotIngestionInstrumentStatus = "STORED" | "DUPLICATE" | "REJECTED" | "UNAVAILABLE" | "MARKET_CLOSED";

export interface SnapshotIngestionInstrumentResult {
  readonly instrument: UpstoxIndexSymbol;
  readonly status: SnapshotIngestionInstrumentStatus;
  readonly snapshotId: string | null;
  readonly warning: string | null;
}

export interface SnapshotIngestionRunSummary {
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly attempted: number;
  readonly stored: number;
  readonly duplicate: number;
  readonly rejected: number;
  readonly unavailable: number;
  readonly instrumentResults: readonly SnapshotIngestionInstrumentResult[];
  readonly safeWarnings: readonly string[];
}

export interface SnapshotIngestionRunnerOptions {
  readonly repository?: Pick<DecisionPersistenceRepository, "recordMarketSnapshot">;
  readonly instruments?: readonly UpstoxIndexSymbol[];
  readonly nowIso?: string;
  readonly fetchQuote?: (symbol: UpstoxIndexSymbol, nowIso: string) => Promise<UpstoxIndexQuoteResult | { readonly ok: false; readonly reason: string; readonly detail?: string }>;
  readonly logger?: StructuredLogger;
}

export interface ScheduledEvaluationRunnerOptions extends SnapshotIngestionRunnerOptions {
  readonly executionId?: string;
  readonly schedulerRepository?: Pick<DecisionPersistenceRepository, "listDecisionRuns" | "getDecisionRunById" | "getOutcome" | "recordOutcome" | "findVerifiedSnapshot">;
  readonly recordExecution?: boolean;
}

const SUPPORTED_LIFECYCLE_INSTRUMENTS: readonly UpstoxIndexSymbol[] = ["NIFTY50", "BANKNIFTY", "INDIA_VIX"];
let inFlight: Promise<LifecycleExecutionSummary> | null = null;
let retryCount = 0;

function boundedWarning(message: string): string {
  return message.replace(/token|secret|authorization|cookie|api[-_]?key|bearer/gi, "[REDACTED]").slice(0, 160);
}

function executionId(startedAt: string): string {
  return `decision-lifecycle::${startedAt}`;
}

function duration(startedAt: string, completedAt: string): number {
  const start = Date.parse(startedAt);
  const done = Date.parse(completedAt);
  return Number.isFinite(start) && Number.isFinite(done) ? Math.max(0, done - start) : 0;
}

function statusFrom(snapshotSummary: SnapshotIngestionRunSummary, scheduler: OutcomeSchedulerRunResult): LifecycleExecutionStatus {
  if (snapshotSummary.attempted === 0 && scheduler.evaluatedQueue === 0 && scheduler.pendingQueue === 0) return "NO_WORK";
  if (scheduler.items.some((item) => item.status === "FAILED")) return "PARTIAL";
  if (snapshotSummary.unavailable > 0 && snapshotSummary.stored === 0 && snapshotSummary.duplicate === 0) return "DEGRADED";
  if (scheduler.evaluatedQueue > 0 || snapshotSummary.stored > 0 || snapshotSummary.duplicate > 0) return "SUCCESS";
  if (scheduler.pendingQueue > 0 || scheduler.skippedQueue > 0) return "NO_WORK";
  return "NO_WORK";
}

export async function runSnapshotIngestionRunner(options: SnapshotIngestionRunnerOptions = {}): Promise<SnapshotIngestionRunSummary> {
  const startedAt = options.nowIso ?? new Date().toISOString();
  const logger = options.logger ?? new StructuredLogger({ correlationId: newCorrelationId() });
  const repository = options.repository ?? defaultDecisionHistoryRepository;
  const instruments = options.instruments ?? SUPPORTED_LIFECYCLE_INSTRUMENTS;
  const fetchQuote = options.fetchQuote ?? fetchUpstoxIndexQuote;
  const results: SnapshotIngestionInstrumentResult[] = [];
  const warnings: string[] = [];

  for (const instrument of instruments) {
    try {
      const quoteResult = await fetchQuote(instrument, startedAt);
      if (!quoteResult.ok) {
        warnings.push(boundedWarning(`${instrument}: PROVIDER_UNAVAILABLE`));
        results.push({ instrument, status: "UNAVAILABLE", snapshotId: null, warning: "PROVIDER_UNAVAILABLE" });
        recordEvent({ type: "provider.failure", tag: instrument, detail: "PROVIDER_UNAVAILABLE" });
        continue;
      }
      if (quoteResult.quote.marketState === "CLOSED") {
        warnings.push(boundedWarning(`${instrument}: MARKET_CLOSED`));
        results.push({ instrument, status: "MARKET_CLOSED", snapshotId: null, warning: "MARKET_CLOSED" });
        continue;
      }
      const ingestion = await ingestVerifiedMarketSnapshot(
        normalizedInputFromIndexQuote(quoteResult.quote, quoteResult.providerMetadata, startedAt, instrument),
        repository,
      );
      const writeStatus: DecisionMarketSnapshotWriteResult["status"] | null = ingestion.write?.status ?? null;
      const status: SnapshotIngestionInstrumentStatus = writeStatus === "STORED"
        ? "STORED"
        : writeStatus === "DUPLICATE"
          ? "DUPLICATE"
          : ingestion.status === "UNAVAILABLE"
            ? "UNAVAILABLE"
            : "REJECTED";
      if (status === "REJECTED") warnings.push(boundedWarning(`${instrument}: SNAPSHOT_REJECTED`));
      results.push({ instrument, status, snapshotId: ingestion.snapshot?.snapshotId ?? null, warning: ingestion.reason });
    } catch {
      warnings.push(boundedWarning(`${instrument}: PROVIDER_UNAVAILABLE`));
      results.push({ instrument, status: "UNAVAILABLE", snapshotId: null, warning: "PROVIDER_UNAVAILABLE" });
      recordEvent({ type: "provider.failure", tag: instrument, detail: "PROVIDER_UNAVAILABLE" });
    }
  }

  const completedAt = new Date(Date.parse(startedAt) + 1).toISOString();
  const summary = Object.freeze({
    runId: `snapshot-ingestion::${startedAt}`,
    startedAt,
    completedAt,
    attempted: results.filter((item) => item.status !== "MARKET_CLOSED").length,
    stored: results.filter((item) => item.status === "STORED").length,
    duplicate: results.filter((item) => item.status === "DUPLICATE").length,
    rejected: results.filter((item) => item.status === "REJECTED").length,
    unavailable: results.filter((item) => item.status === "UNAVAILABLE").length,
    instrumentResults: Object.freeze(results),
    safeWarnings: Object.freeze(warnings.map(boundedWarning)),
  } satisfies SnapshotIngestionRunSummary);
  logger.info("decision-history snapshot ingestion completed", { attempted: summary.attempted, stored: summary.stored, rejected: summary.rejected, unavailable: summary.unavailable });
  return summary;
}

async function executeScheduledEvaluation(options: ScheduledEvaluationRunnerOptions): Promise<LifecycleExecutionSummary> {
  const startedAt = options.nowIso ?? new Date().toISOString();
  const ingestion = await runSnapshotIngestionRunner({ ...options, nowIso: startedAt });
  const scheduler = await runOutcomeScheduler({ repository: options.schedulerRepository ?? defaultDecisionHistoryRepository, evaluatedAt: startedAt });
  const completedAt = new Date(Date.parse(startedAt) + Math.max(1, ingestion.instrumentResults.length + scheduler.items.length)).toISOString();
  const warnings = [...ingestion.safeWarnings];
  for (const item of scheduler.items) {
    if (item.status === "SKIPPED_MISSING_SNAPSHOT") warnings.push("NO_VERIFIED_SNAPSHOT");
    if (item.status === "FAILED") warnings.push("EVALUATOR_FAILED");
  }
  const summary = {
    executionId: options.executionId ?? executionId(startedAt),
    startedAt,
    completedAt,
    durationMs: duration(startedAt, completedAt),
    snapshotsAttempted: ingestion.attempted,
    snapshotsStored: ingestion.stored,
    eligibleRuns: scheduler.items.length,
    evaluatedRuns: scheduler.evaluatedQueue,
    skippedRuns: scheduler.skippedQueue,
    pendingRuns: scheduler.pendingQueue,
    failedRuns: scheduler.items.filter((item) => item.status === "FAILED").length,
    status: statusFrom(ingestion, scheduler),
    safeWarnings: Object.freeze(warnings.map(boundedWarning)),
  } satisfies LifecycleExecutionSummary;
  if (options.recordExecution ?? true) return defaultLifecycleExecutionRepository.recordExecution(summary);
  return summary;
}

export async function runScheduledEvaluationLifecycle(options: ScheduledEvaluationRunnerOptions = {}): Promise<LifecycleExecutionSummary> {
  if (inFlight) {
    retryCount += 1;
    return {
      executionId: options.executionId ?? executionId(options.nowIso ?? new Date().toISOString()),
      startedAt: options.nowIso ?? new Date().toISOString(),
      completedAt: options.nowIso ?? new Date().toISOString(),
      durationMs: 0,
      snapshotsAttempted: 0,
      snapshotsStored: 0,
      eligibleRuns: 0,
      evaluatedRuns: 0,
      skippedRuns: 0,
      pendingRuns: 0,
      failedRuns: 1,
      status: "FAILED",
      safeWarnings: ["SCHEDULER_BUSY"],
    };
  }
  inFlight = executeScheduledEvaluation(options).catch((error) => {
    retryCount += 1;
    const now = options.nowIso ?? new Date().toISOString();
    const summary: LifecycleExecutionSummary = {
      executionId: options.executionId ?? executionId(now),
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      snapshotsAttempted: 0,
      snapshotsStored: 0,
      eligibleRuns: 0,
      evaluatedRuns: 0,
      skippedRuns: 0,
      pendingRuns: 0,
      failedRuns: 1,
      status: "FAILED",
      safeWarnings: [boundedWarning(error instanceof Error ? error.message : "UNKNOWN")],
    };
    defaultLifecycleExecutionRepository.recordExecution(summary);
    return summary;
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function getLifecycleRuntimeState(): { readonly inFlight: boolean; readonly retryCount: number } {
  return Object.freeze({ inFlight: inFlight != null, retryCount });
}

export function resetLifecycleRunnerForTests(): void {
  inFlight = null;
  retryCount = 0;
}



