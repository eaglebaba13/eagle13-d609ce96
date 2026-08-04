import type {
  DecisionOutcomeRecord,
  DecisionOutcomeState,
  DecisionOutcomeWriteResult,
  DecisionPersistenceRepository,
  DecisionPersistedRecord,
} from "./types";

export interface FutureMarketSnapshot {
  readonly instrument: string;
  readonly timestamp: string;
  readonly price: number | null;
  readonly providerLabels?: Record<string, string>;
}

export interface EvaluationHorizon {
  readonly label: string;
  readonly expiresAt: string;
  readonly evaluatedAt: string;
}

export type OutcomeEvaluationReason =
  | "HORIZON_PENDING"
  | "MISSING_FUTURE_DATA"
  | "INSTRUMENT_MISMATCH"
  | "CANCELLED_DECISION"
  | "WAIT_DECISION"
  | "BULLISH_PRICE_UP"
  | "BULLISH_PRICE_DOWN"
  | "BEARISH_PRICE_DOWN"
  | "BEARISH_PRICE_UP"
  | "UNCHANGED_PRICE"
  | "UNKNOWN_DIRECTION";

export interface OutcomeEvaluationResult {
  readonly outcome: DecisionOutcomeRecord;
  readonly reason: OutcomeEvaluationReason;
}

export interface EvaluateDecisionOutcomeResult {
  readonly ok: boolean;
  readonly runId: string;
  readonly outcome: DecisionOutcomeRecord | null;
  readonly evaluation: OutcomeEvaluationResult | null;
  readonly write: DecisionOutcomeWriteResult | null;
  readonly reason?: string;
}

function isExpired(horizon: EvaluationHorizon): boolean {
  const evaluatedAt = Date.parse(horizon.evaluatedAt);
  const expiresAt = Date.parse(horizon.expiresAt);
  return Number.isFinite(evaluatedAt) && Number.isFinite(expiresAt) && evaluatedAt >= expiresAt;
}

function decisionDirection(decision: string): "BULL" | "BEAR" | "WAIT" | "CANCELLED" | "UNKNOWN" {
  if (/CANCEL/i.test(decision)) return "CANCELLED";
  if (/WAIT|HOLD|NEUTRAL/i.test(decision)) return "WAIT";
  if (/PE|PUT|BEAR|SHORT|SELL/i.test(decision)) return "BEAR";
  if (/CE|CALL|BULL|LONG|BUY/i.test(decision)) return "BULL";
  return "UNKNOWN";
}

function unevaluated(
  run: DecisionPersistedRecord,
  snapshot: FutureMarketSnapshot | null,
  horizon: EvaluationHorizon,
  reason: OutcomeEvaluationReason,
): OutcomeEvaluationResult {
  return {
    reason,
    outcome: {
      runId: run.runId,
      instrument: run.instrument,
      decision: run.decision,
      decisionTimestamp: run.timestamp,
      evaluatedAt: horizon.evaluatedAt,
      evaluationHorizon: horizon.label,
      entryReferencePrice: run.spot,
      futurePrice: snapshot?.price ?? null,
      outcomeState: "UNEVALUATED",
      confidence: run.confidence,
      formulaVersions: { ...run.formulaVersions },
      providerLabels: { ...run.providerLabels, ...(snapshot?.providerLabels ?? {}) },
    },
  };
}

export function evaluateOutcomeRecord(
  run: DecisionPersistedRecord,
  snapshot: FutureMarketSnapshot | null,
  horizon: EvaluationHorizon,
): OutcomeEvaluationResult {
  if (!isExpired(horizon)) return unevaluated(run, snapshot, horizon, "HORIZON_PENDING");
  if (!snapshot || snapshot.price == null || !Number.isFinite(snapshot.price)) {
    return unevaluated(run, snapshot, horizon, "MISSING_FUTURE_DATA");
  }
  if (snapshot.instrument !== run.instrument) return unevaluated(run, snapshot, horizon, "INSTRUMENT_MISMATCH");
  if (run.spot == null || !Number.isFinite(run.spot)) return unevaluated(run, snapshot, horizon, "MISSING_FUTURE_DATA");

  const direction = decisionDirection(run.decision);
  let outcomeState: DecisionOutcomeState = "UNEVALUATED";
  let reason: OutcomeEvaluationReason = "UNKNOWN_DIRECTION";
  if (direction === "CANCELLED") {
    outcomeState = "CANCELLED";
    reason = "CANCELLED_DECISION";
  } else if (direction === "WAIT") {
    outcomeState = "NEUTRAL";
    reason = "WAIT_DECISION";
  } else if (snapshot.price === run.spot) {
    outcomeState = "NEUTRAL";
    reason = "UNCHANGED_PRICE";
  } else if (direction === "BULL") {
    outcomeState = snapshot.price > run.spot ? "WIN" : "LOSS";
    reason = snapshot.price > run.spot ? "BULLISH_PRICE_UP" : "BULLISH_PRICE_DOWN";
  } else if (direction === "BEAR") {
    outcomeState = snapshot.price < run.spot ? "WIN" : "LOSS";
    reason = snapshot.price < run.spot ? "BEARISH_PRICE_DOWN" : "BEARISH_PRICE_UP";
  }

  return {
    reason,
    outcome: {
      runId: run.runId,
      instrument: run.instrument,
      decision: run.decision,
      decisionTimestamp: run.timestamp,
      evaluatedAt: horizon.evaluatedAt,
      evaluationHorizon: horizon.label,
      entryReferencePrice: run.spot,
      futurePrice: snapshot.price,
      outcomeState,
      confidence: run.confidence,
      formulaVersions: { ...run.formulaVersions },
      providerLabels: { ...run.providerLabels, ...(snapshot.providerLabels ?? {}) },
    },
  };
}

export async function evaluateDecisionOutcome(
  repository: Pick<DecisionPersistenceRepository, "getDecisionRunById" | "getOutcome" | "recordOutcome">,
  runId: string,
  snapshot: FutureMarketSnapshot | null,
  horizon: EvaluationHorizon,
): Promise<EvaluateDecisionOutcomeResult> {
  const run = repository.getDecisionRunById?.(runId) ?? null;
  if (!run) return { ok: false, runId, outcome: null, evaluation: null, write: null, reason: "Decision run not found." };

  const existing = repository.getOutcome?.(runId) ?? null;
  if (existing) {
    return { ok: true, runId, outcome: existing, evaluation: null, write: { ok: true, runId, status: "DUPLICATE" } };
  }

  const evaluation = evaluateOutcomeRecord(run, snapshot, horizon);
  if (evaluation.outcome.outcomeState === "UNEVALUATED") {
    return { ok: false, runId, outcome: evaluation.outcome, evaluation, write: null, reason: evaluation.reason };
  }

  const write = await repository.recordOutcome?.(evaluation.outcome);
  if (!write) return { ok: false, runId, outcome: evaluation.outcome, evaluation, write: null, reason: "Repository cannot record outcomes." };
  return { ok: write.ok, runId, outcome: evaluation.outcome, evaluation, write, reason: write.reason };
}
