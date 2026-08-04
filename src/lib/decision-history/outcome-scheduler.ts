import { evaluateDecisionOutcome, type EvaluationHorizon, type FutureMarketSnapshot } from "./outcome-evaluator";
import { defaultDecisionHistoryRepository } from "./repository";
import { findSchedulerVerifiedSnapshot, DEFAULT_SCHEDULER_SNAPSHOT_DISTANCE_MS } from "./market-snapshots";
import type { DecisionPersistenceRepository, DecisionPersistedRecord } from "./types";

export type OutcomeSchedulerStatus = "IDLE" | "COMPLETED" | "PARTIAL" | "NO_ELIGIBLE_RUNS" | "FAILED";

export type OutcomeSchedulerItemStatus =
  | "EVALUATED"
  | "SKIPPED_ALREADY_EVALUATED"
  | "SKIPPED_HORIZON_PENDING"
  | "SKIPPED_MISSING_SNAPSHOT"
  | "SKIPPED_PROVIDER_FAILURE"
  | "FAILED";

export interface VerifiedSnapshotRequest {
  readonly run: DecisionPersistedRecord;
  readonly horizon: EvaluationHorizon;
}

export type VerifiedMarketSnapshotLoader = (
  request: VerifiedSnapshotRequest,
) => Promise<FutureMarketSnapshot | null> | FutureMarketSnapshot | null;

export type EvaluationHorizonResolver = (
  run: DecisionPersistedRecord,
  evaluatedAt: string,
) => EvaluationHorizon;

export interface OutcomeSchedulerItemResult {
  readonly runId: string;
  readonly status: OutcomeSchedulerItemStatus;
  readonly reason: string | null;
  readonly evaluationDurationMs: number | null;
}

export interface OutcomeSchedulerRunResult {
  readonly status: OutcomeSchedulerStatus;
  readonly pendingQueue: number;
  readonly evaluatedQueue: number;
  readonly skippedQueue: number;
  readonly lastEvaluationTime: string | null;
  readonly averageEvaluationDurationMs: number | null;
  readonly repositoryHealth: "OK" | "UNAVAILABLE";
  readonly items: readonly OutcomeSchedulerItemResult[];
}

export interface OutcomeSchedulerDiagnostics {
  readonly pendingQueue: number;
  readonly evaluatedQueue: number;
  readonly skippedQueue: number;
  readonly schedulerStatus: OutcomeSchedulerStatus;
  readonly lastEvaluationTime: string | null;
  readonly averageEvaluationDurationMs: number | null;
  readonly repositoryHealth: "OK" | "UNAVAILABLE";
}

export interface RunOutcomeSchedulerOptions {
  readonly repository?: Pick<
    DecisionPersistenceRepository,
    "listDecisionRuns" | "getDecisionRunById" | "getOutcome" | "recordOutcome" | "findVerifiedSnapshot"
  >;
  readonly loadVerifiedSnapshot?: VerifiedMarketSnapshotLoader;
  readonly maximumSnapshotDistanceMs?: number;
  readonly providerAlias?: string;
  readonly resolveHorizon?: EvaluationHorizonResolver;
  readonly evaluatedAt?: string;
  readonly limit?: number;
}

const DEFAULT_EVALUATION_HORIZON = "30m";

let lastSchedulerRun: OutcomeSchedulerRunResult = Object.freeze({
  status: "IDLE",
  pendingQueue: 0,
  evaluatedQueue: 0,
  skippedQueue: 0,
  lastEvaluationTime: null,
  averageEvaluationDurationMs: null,
  repositoryHealth: "OK",
  items: [],
} satisfies OutcomeSchedulerRunResult);

function parseDurationMs(label: string): number {
  const normalized = label.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(ms|s|m|h|d)$/);
  if (!match) return 30 * 60 * 1000;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 30 * 60 * 1000;
  const unit = match[2];
  if (unit === "ms") return value;
  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60 * 1000;
  if (unit === "h") return value * 60 * 60 * 1000;
  return value * 24 * 60 * 60 * 1000;
}

function summaryHorizon(run: DecisionPersistedRecord): string {
  const candidate = run.summary.evaluationHorizon ?? run.summary.outcomeEvaluationHorizon;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : DEFAULT_EVALUATION_HORIZON;
}

export function resolveDecisionEvaluationHorizon(
  run: DecisionPersistedRecord,
  evaluatedAt: string,
): EvaluationHorizon {
  const label = summaryHorizon(run);
  const decisionTime = Date.parse(run.timestamp);
  const durationMs = parseDurationMs(label);
  const expiresAt = Number.isFinite(decisionTime)
    ? new Date(decisionTime + durationMs).toISOString()
    : evaluatedAt;
  return { label, expiresAt, evaluatedAt };
}

function horizonExpired(horizon: EvaluationHorizon): boolean {
  const evaluatedAt = Date.parse(horizon.evaluatedAt);
  const expiresAt = Date.parse(horizon.expiresAt);
  return Number.isFinite(evaluatedAt) && Number.isFinite(expiresAt) && evaluatedAt >= expiresAt;
}

function safeItem(
  runId: string,
  status: OutcomeSchedulerItemStatus,
  reason: string | null,
  evaluationDurationMs: number | null = null,
): OutcomeSchedulerItemResult {
  return Object.freeze({ runId, status, reason, evaluationDurationMs });
}

function finalizeSchedulerRun(
  items: readonly OutcomeSchedulerItemResult[],
  repositoryHealth: "OK" | "UNAVAILABLE",
  evaluatedAt: string | null,
): OutcomeSchedulerRunResult {
  const evaluated = items.filter((item) => item.status === "EVALUATED");
  const skipped = items.filter((item) => item.status !== "EVALUATED");
  const durations = evaluated
    .map((item) => item.evaluationDurationMs)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const status: OutcomeSchedulerStatus =
    repositoryHealth === "UNAVAILABLE"
      ? "FAILED"
      : items.length === 0
        ? "NO_ELIGIBLE_RUNS"
        : skipped.length > 0
          ? "PARTIAL"
          : "COMPLETED";

  const result = {
    status,
    pendingQueue: skipped.filter((item) =>
      item.status === "SKIPPED_HORIZON_PENDING" ||
      item.status === "SKIPPED_MISSING_SNAPSHOT" ||
      item.status === "SKIPPED_PROVIDER_FAILURE"
    ).length,
    evaluatedQueue: evaluated.length,
    skippedQueue: skipped.length,
    lastEvaluationTime: evaluated.length > 0 ? evaluatedAt : null,
    averageEvaluationDurationMs: durations.length > 0
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null,
    repositoryHealth,
    items: Object.freeze([...items]),
  } satisfies OutcomeSchedulerRunResult;

  return Object.freeze(result);
}

export async function runOutcomeScheduler(
  options: RunOutcomeSchedulerOptions,
): Promise<OutcomeSchedulerRunResult> {
  const repository = options.repository ?? defaultDecisionHistoryRepository;
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const resolveHorizon = options.resolveHorizon ?? resolveDecisionEvaluationHorizon;

  if (!repository.listDecisionRuns || !repository.getOutcome || !repository.getDecisionRunById || !repository.recordOutcome) {
    lastSchedulerRun = finalizeSchedulerRun([], "UNAVAILABLE", null);
    return lastSchedulerRun;
  }

  const runs = repository.listDecisionRuns({ limit: options.limit });
  const items: OutcomeSchedulerItemResult[] = [];

  for (const run of runs) {
    if (repository.getOutcome(run.runId)) {
      items.push(safeItem(run.runId, "SKIPPED_ALREADY_EVALUATED", "Outcome already exists."));
      continue;
    }

    const horizon = resolveHorizon(run, evaluatedAt);
    if (!horizonExpired(horizon)) {
      items.push(safeItem(run.runId, "SKIPPED_HORIZON_PENDING", "Evaluation horizon has not expired."));
      continue;
    }

    let snapshot: FutureMarketSnapshot | null = null;
    try {
      snapshot = options.loadVerifiedSnapshot
        ? await options.loadVerifiedSnapshot({ run, horizon })
        : findSchedulerVerifiedSnapshot(repository, {
            instrument: run.instrument,
            evaluationTimestamp: horizon.expiresAt,
            maximumAllowedDistanceMs: options.maximumSnapshotDistanceMs ?? DEFAULT_SCHEDULER_SNAPSHOT_DISTANCE_MS,
            providerAlias: options.providerAlias,
          });
    } catch {
      items.push(safeItem(run.runId, "SKIPPED_PROVIDER_FAILURE", "Verified snapshot loader failed."));
      continue;
    }

    if (!snapshot || snapshot.price == null || !Number.isFinite(snapshot.price)) {
      items.push(safeItem(run.runId, "SKIPPED_MISSING_SNAPSHOT", "Verified future snapshot unavailable."));
      continue;
    }

    const startedAt = Date.parse(evaluatedAt);
    const result = await evaluateDecisionOutcome(repository, run.runId, snapshot, horizon);
    if (!result.ok) {
      items.push(safeItem(run.runId, "FAILED", result.reason ?? "Outcome evaluation failed."));
      continue;
    }
    const finishedAt = Date.parse(horizon.evaluatedAt);
    const duration = Number.isFinite(startedAt) && Number.isFinite(finishedAt)
      ? Math.max(0, finishedAt - startedAt)
      : null;
    items.push(safeItem(run.runId, "EVALUATED", result.write?.status ?? null, duration));
  }

  lastSchedulerRun = finalizeSchedulerRun(items, "OK", evaluatedAt);
  return lastSchedulerRun;
}

export function getOutcomeSchedulerDiagnostics(): OutcomeSchedulerDiagnostics {
  return Object.freeze({
    pendingQueue: lastSchedulerRun.pendingQueue,
    evaluatedQueue: lastSchedulerRun.evaluatedQueue,
    skippedQueue: lastSchedulerRun.skippedQueue,
    schedulerStatus: lastSchedulerRun.status,
    lastEvaluationTime: lastSchedulerRun.lastEvaluationTime,
    averageEvaluationDurationMs: lastSchedulerRun.averageEvaluationDurationMs,
    repositoryHealth: lastSchedulerRun.repositoryHealth,
  });
}

export function resetOutcomeSchedulerForTests(): void {
  lastSchedulerRun = Object.freeze({
    status: "IDLE",
    pendingQueue: 0,
    evaluatedQueue: 0,
    skippedQueue: 0,
    lastEvaluationTime: null,
    averageEvaluationDurationMs: null,
    repositoryHealth: "OK",
    items: [],
  });
}

