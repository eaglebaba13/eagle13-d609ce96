import type {
  DecisionOutcomeRecord,
  DecisionOutcomeStats,
  DecisionOutcomeState,
  OutcomeBucketStats,
  OutcomeConfidenceBuckets,
} from "./types";

const EMPTY_BUCKETS: OutcomeConfidenceBuckets = {
  "0-25": 0,
  "26-50": 0,
  "51-75": 0,
  "76-100": 0,
};

function emptyStats(): OutcomeBucketStats {
  return {
    total: 0,
    wins: 0,
    losses: 0,
    neutral: 0,
    expired: 0,
    winRatePct: null,
    lossRatePct: null,
    neutralRatePct: null,
  };
}

function finalizeBucket(bucket: OutcomeBucketStats): OutcomeBucketStats {
  return {
    ...bucket,
    winRatePct: bucket.total > 0 ? (bucket.wins / bucket.total) * 100 : null,
    lossRatePct: bucket.total > 0 ? (bucket.losses / bucket.total) * 100 : null,
    neutralRatePct: bucket.total > 0 ? ((bucket.neutral + bucket.expired) / bucket.total) * 100 : null,
  };
}

export function isEvaluatedOutcome(state: DecisionOutcomeState): boolean {
  return state === "WIN" || state === "LOSS" || state === "NEUTRAL" || state === "TIME_EXPIRED";
}

function bucketConfidence(confidence: number | null): keyof OutcomeConfidenceBuckets | null {
  if (confidence == null || !Number.isFinite(confidence)) return null;
  const c = Math.max(0, Math.min(100, confidence));
  if (c <= 25) return "0-25";
  if (c <= 50) return "26-50";
  if (c <= 75) return "51-75";
  return "76-100";
}

function addToBucket(bucket: OutcomeBucketStats, state: DecisionOutcomeState): OutcomeBucketStats {
  return {
    ...bucket,
    total: bucket.total + 1,
    wins: bucket.wins + (state === "WIN" ? 1 : 0),
    losses: bucket.losses + (state === "LOSS" ? 1 : 0),
    neutral: bucket.neutral + (state === "NEUTRAL" ? 1 : 0),
    expired: bucket.expired + (state === "TIME_EXPIRED" ? 1 : 0),
  };
}

export function buildOutcomeStats(outcomes: readonly DecisionOutcomeRecord[]): DecisionOutcomeStats {
  let pendingOutcomes = 0;
  let unevaluatedOutcomes = 0;
  let cancelledOutcomes = 0;
  let evaluatedOutcomes = 0;
  let wins = 0;
  let losses = 0;
  let neutral = 0;
  let expired = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  let evaluationTimeSum = 0;
  let evaluationTimeCount = 0;
  const confidenceBuckets: { -readonly [K in keyof OutcomeConfidenceBuckets]: number } = { ...EMPTY_BUCKETS };
  const byDecision: Record<string, OutcomeBucketStats> = {};
  const byInstrument: Record<string, OutcomeBucketStats> = {};

  for (const outcome of outcomes) {
    if (outcome.outcomeState === "PENDING") pendingOutcomes += 1;
    if (outcome.outcomeState === "UNEVALUATED") unevaluatedOutcomes += 1;
    if (outcome.outcomeState === "CANCELLED") cancelledOutcomes += 1;
    if (!isEvaluatedOutcome(outcome.outcomeState)) continue;

    evaluatedOutcomes += 1;
    if (outcome.outcomeState === "WIN") wins += 1;
    if (outcome.outcomeState === "LOSS") losses += 1;
    if (outcome.outcomeState === "NEUTRAL") neutral += 1;
    if (outcome.outcomeState === "TIME_EXPIRED") expired += 1;

    if (outcome.confidence != null && Number.isFinite(outcome.confidence)) {
      confidenceSum += outcome.confidence;
      confidenceCount += 1;
      const bucket = bucketConfidence(outcome.confidence);
      if (bucket) confidenceBuckets[bucket] += 1;
    }

    const evaluationTimeMs = Date.parse(outcome.evaluatedAt) - Date.parse(outcome.decisionTimestamp);
    if (Number.isFinite(evaluationTimeMs) && evaluationTimeMs >= 0) {
      evaluationTimeSum += evaluationTimeMs;
      evaluationTimeCount += 1;
    }

    const decisionBucket = byDecision[outcome.decision] ?? emptyStats();
    byDecision[outcome.decision] = addToBucket(decisionBucket, outcome.outcomeState);
    const instrumentBucket = byInstrument[outcome.instrument] ?? emptyStats();
    byInstrument[outcome.instrument] = addToBucket(instrumentBucket, outcome.outcomeState);
  }

  const finalizedByDecision: Record<string, OutcomeBucketStats> = {};
  for (const [key, value] of Object.entries(byDecision).sort(([a], [b]) => a.localeCompare(b))) {
    finalizedByDecision[key] = finalizeBucket(value);
  }
  const finalizedByInstrument: Record<string, OutcomeBucketStats> = {};
  for (const [key, value] of Object.entries(byInstrument).sort(([a], [b]) => a.localeCompare(b))) {
    finalizedByInstrument[key] = finalizeBucket(value);
  }

  return {
    storedOutcomes: outcomes.length,
    evaluatedOutcomes,
    pendingOutcomes,
    unevaluatedOutcomes,
    pendingRuns: pendingOutcomes + unevaluatedOutcomes,
    cancelledOutcomes,
    wins,
    losses,
    neutral,
    expired,
    winRatePct: evaluatedOutcomes > 0 ? (wins / evaluatedOutcomes) * 100 : null,
    lossRatePct: evaluatedOutcomes > 0 ? (losses / evaluatedOutcomes) * 100 : null,
    neutralRatePct: evaluatedOutcomes > 0 ? ((neutral + expired) / evaluatedOutcomes) * 100 : null,
    averageConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : null,
    averageEvaluationTimeMs: evaluationTimeCount > 0 ? evaluationTimeSum / evaluationTimeCount : null,
    confidenceBuckets,
    byDecision: finalizedByDecision,
    byInstrument: finalizedByInstrument,
    historicalAccuracyReady: evaluatedOutcomes > 0,
    learningReady: evaluatedOutcomes > 0,
  };
}

export type DecisionPerformanceStatus = "SUPPORTED" | "NO_DATA";

export interface DecisionPerformanceBreakdown extends OutcomeBucketStats {
  readonly averageConfidence: number | null;
  readonly averageEvaluationTimeMs: number | null;
}

export interface DecisionPerformanceAnalytics {
  readonly status: DecisionPerformanceStatus;
  readonly reason: string;
  readonly overallWinRatePct: number | null;
  readonly lossRatePct: number | null;
  readonly neutralRatePct: number | null;
  readonly averageConfidence: number | null;
  readonly averageEvaluationTimeMs: number | null;
  readonly totalEvaluatedRuns: number;
  readonly pendingRuns: number;
  readonly cancelledRuns: number;
  readonly byInstrument: Record<string, DecisionPerformanceBreakdown>;
  readonly byTimeframe: Record<string, DecisionPerformanceBreakdown>;
  readonly byStrategy: Record<string, DecisionPerformanceBreakdown>;
  readonly bySignalDirection: Record<string, DecisionPerformanceBreakdown>;
  readonly byConfidenceBucket: Record<keyof OutcomeConfidenceBuckets, DecisionPerformanceBreakdown>;
}

type MutableBreakdown = {
  total: number;
  wins: number;
  losses: number;
  neutral: number;
  expired: number;
  confidenceSum: number;
  confidenceCount: number;
  evaluationTimeSum: number;
  evaluationTimeCount: number;
};

function deepFreezeAnalytics<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === "object") deepFreezeAnalytics(child);
    }
  }
  return value;
}

function emptyMutableBreakdown(): MutableBreakdown {
  return {
    total: 0,
    wins: 0,
    losses: 0,
    neutral: 0,
    expired: 0,
    confidenceSum: 0,
    confidenceCount: 0,
    evaluationTimeSum: 0,
    evaluationTimeCount: 0,
  };
}

function confidenceBucketKey(confidence: number | null): keyof OutcomeConfidenceBuckets | null {
  if (confidence == null || !Number.isFinite(confidence)) return null;
  const c = Math.max(0, Math.min(100, confidence));
  if (c <= 25) return "0-25";
  if (c <= 50) return "26-50";
  if (c <= 75) return "51-75";
  return "76-100";
}

function signalDirection(decision: string): "BUY" | "SELL" | "WAIT" | "UNKNOWN" {
  if (/WAIT|HOLD|NEUTRAL/i.test(decision)) return "WAIT";
  if (/PE|PUT|BEAR|SHORT|SELL/i.test(decision)) return "SELL";
  if (/CE|CALL|BULL|LONG|BUY/i.test(decision)) return "BUY";
  return "UNKNOWN";
}

function strategyKey(outcome: DecisionOutcomeRecord): string {
  const explicit = outcome.formulaVersions.strategy ?? outcome.formulaVersions.decision;
  if (explicit) return explicit;
  const entries = Object.entries(outcome.formulaVersions).sort(([a], [b]) => a.localeCompare(b));
  return entries.length > 0 ? entries.map(([k, v]) => `${k}:${v}`).join("|") : "UNKNOWN";
}

function addPerformanceBucket(target: MutableBreakdown, outcome: DecisionOutcomeRecord): void {
  target.total += 1;
  if (outcome.outcomeState === "WIN") target.wins += 1;
  if (outcome.outcomeState === "LOSS") target.losses += 1;
  if (outcome.outcomeState === "NEUTRAL") target.neutral += 1;
  if (outcome.outcomeState === "TIME_EXPIRED") target.expired += 1;
  if (outcome.confidence != null && Number.isFinite(outcome.confidence)) {
    target.confidenceSum += outcome.confidence;
    target.confidenceCount += 1;
  }
  const evaluationTimeMs = Date.parse(outcome.evaluatedAt) - Date.parse(outcome.decisionTimestamp);
  if (Number.isFinite(evaluationTimeMs) && evaluationTimeMs >= 0) {
    target.evaluationTimeSum += evaluationTimeMs;
    target.evaluationTimeCount += 1;
  }
}

function finalizePerformanceBucket(bucket: MutableBreakdown): DecisionPerformanceBreakdown {
  return {
    total: bucket.total,
    wins: bucket.wins,
    losses: bucket.losses,
    neutral: bucket.neutral,
    expired: bucket.expired,
    winRatePct: bucket.total > 0 ? (bucket.wins / bucket.total) * 100 : null,
    lossRatePct: bucket.total > 0 ? (bucket.losses / bucket.total) * 100 : null,
    neutralRatePct: bucket.total > 0 ? ((bucket.neutral + bucket.expired) / bucket.total) * 100 : null,
    averageConfidence: bucket.confidenceCount > 0 ? bucket.confidenceSum / bucket.confidenceCount : null,
    averageEvaluationTimeMs: bucket.evaluationTimeCount > 0 ? bucket.evaluationTimeSum / bucket.evaluationTimeCount : null,
  };
}

function finalizeBreakdowns(source: Record<string, MutableBreakdown>): Record<string, DecisionPerformanceBreakdown> {
  const out: Record<string, DecisionPerformanceBreakdown> = {};
  for (const [key, value] of Object.entries(source).sort(([a], [b]) => a.localeCompare(b))) {
    out[key] = finalizePerformanceBucket(value);
  }
  return out;
}

export function buildDecisionPerformanceAnalytics(
  outcomes: readonly DecisionOutcomeRecord[],
): DecisionPerformanceAnalytics {
  const stats = buildOutcomeStats(outcomes);
  const evaluated = outcomes.filter((outcome) => isEvaluatedOutcome(outcome.outcomeState));
  const byInstrument: Record<string, MutableBreakdown> = {};
  const byTimeframe: Record<string, MutableBreakdown> = {};
  const byStrategy: Record<string, MutableBreakdown> = {};
  const bySignalDirection: Record<string, MutableBreakdown> = {};
  const byConfidenceBucketMutable: Record<keyof OutcomeConfidenceBuckets, MutableBreakdown> = {
    "0-25": emptyMutableBreakdown(),
    "26-50": emptyMutableBreakdown(),
    "51-75": emptyMutableBreakdown(),
    "76-100": emptyMutableBreakdown(),
  };

  for (const outcome of evaluated) {
    const instrument = outcome.instrument || "UNKNOWN";
    const timeframe = outcome.evaluationHorizon || "UNKNOWN";
    const strategy = strategyKey(outcome);
    const direction = signalDirection(outcome.decision);
    byInstrument[instrument] ??= emptyMutableBreakdown();
    byTimeframe[timeframe] ??= emptyMutableBreakdown();
    byStrategy[strategy] ??= emptyMutableBreakdown();
    bySignalDirection[direction] ??= emptyMutableBreakdown();
    addPerformanceBucket(byInstrument[instrument], outcome);
    addPerformanceBucket(byTimeframe[timeframe], outcome);
    addPerformanceBucket(byStrategy[strategy], outcome);
    addPerformanceBucket(bySignalDirection[direction], outcome);
    const confidenceBucket = confidenceBucketKey(outcome.confidence);
    if (confidenceBucket) addPerformanceBucket(byConfidenceBucketMutable[confidenceBucket], outcome);
  }

  return deepFreezeAnalytics({
    status: stats.evaluatedOutcomes > 0 ? "SUPPORTED" : "NO_DATA",
    reason: stats.evaluatedOutcomes > 0
      ? `Analytics built from ${stats.evaluatedOutcomes} evaluated outcomes`
      : "No evaluated decision outcomes available",
    overallWinRatePct: stats.winRatePct,
    lossRatePct: stats.lossRatePct,
    neutralRatePct: stats.neutralRatePct,
    averageConfidence: stats.averageConfidence,
    averageEvaluationTimeMs: stats.averageEvaluationTimeMs,
    totalEvaluatedRuns: stats.evaluatedOutcomes,
    pendingRuns: stats.pendingRuns,
    cancelledRuns: stats.cancelledOutcomes,
    byInstrument: finalizeBreakdowns(byInstrument),
    byTimeframe: finalizeBreakdowns(byTimeframe),
    byStrategy: finalizeBreakdowns(byStrategy),
    bySignalDirection: finalizeBreakdowns(bySignalDirection),
    byConfidenceBucket: {
      "0-25": finalizePerformanceBucket(byConfidenceBucketMutable["0-25"]),
      "26-50": finalizePerformanceBucket(byConfidenceBucketMutable["26-50"]),
      "51-75": finalizePerformanceBucket(byConfidenceBucketMutable["51-75"]),
      "76-100": finalizePerformanceBucket(byConfidenceBucketMutable["76-100"]),
    },
  });
}
