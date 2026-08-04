export interface DecisionPersistedRecord {
  readonly runId: string;
  readonly timestamp: string;
  readonly instrument: string;
  readonly spot: number | null;
  readonly decision: string;
  readonly confidence: number | null;
  readonly risk: {
    readonly level: string;
    readonly reasons: readonly string[];
  };
  readonly signals: readonly unknown[];
  readonly capabilities: Record<string, unknown>;
  readonly summary: Record<string, unknown>;
  readonly formulaVersions: Record<string, string>;
  readonly providerLabels: Record<string, string>;
}

export interface DecisionHistoryStats {
  readonly repositoryType?: "IN_MEMORY" | "SUPABASE";
  readonly durability?: "PROCESS_LIFETIME" | "DURABLE";
  readonly totalRuns: number;
  readonly oldestTimestamp: string | null;
  readonly newestTimestamp: string | null;
  readonly instruments: readonly string[];
  readonly retentionLimit: number;
  readonly droppedRunCount: number;
  readonly lastPersistenceError: string | null;
}

export type DecisionOutcomeState =
  | "PENDING"
  | "WIN"
  | "LOSS"
  | "NEUTRAL"
  | "TIME_EXPIRED"
  | "CANCELLED"
  | "UNEVALUATED";

export interface DecisionOutcomeRecord {
  readonly runId: string;
  readonly instrument: string;
  readonly decision: string;
  readonly decisionTimestamp: string;
  readonly evaluatedAt: string;
  readonly evaluationHorizon: string;
  readonly entryReferencePrice: number | null;
  readonly futurePrice: number | null;
  readonly outcomeState: DecisionOutcomeState;
  readonly confidence: number | null;
  readonly formulaVersions: Record<string, string>;
  readonly providerLabels: Record<string, string>;
}

export type DecisionOutcomeWriteStatus =
  | "RECORDED"
  | "DUPLICATE"
  | "CONFLICT"
  | "MISSING_RUN"
  | "FAILED";

export interface DecisionOutcomeWriteResult {
  readonly ok: boolean;
  readonly runId: string;
  readonly status: DecisionOutcomeWriteStatus;
  readonly reason?: string;
}

export interface OutcomeBucketStats {
  readonly total: number;
  readonly wins: number;
  readonly losses: number;
  readonly neutral: number;
  readonly expired: number;
  readonly winRatePct: number | null;
  readonly lossRatePct: number | null;
  readonly neutralRatePct: number | null;
}

export interface OutcomeConfidenceBuckets {
  readonly "0-25": number;
  readonly "26-50": number;
  readonly "51-75": number;
  readonly "76-100": number;
}

export interface DecisionOutcomeStats {
  readonly storedOutcomes: number;
  readonly evaluatedOutcomes: number;
  readonly pendingOutcomes: number;
  readonly unevaluatedOutcomes: number;
  readonly pendingRuns: number;
  readonly cancelledOutcomes: number;
  readonly wins: number;
  readonly losses: number;
  readonly neutral: number;
  readonly expired: number;
  readonly winRatePct: number | null;
  readonly lossRatePct: number | null;
  readonly neutralRatePct: number | null;
  readonly averageConfidence: number | null;
  readonly averageEvaluationTimeMs: number | null;
  readonly confidenceBuckets: OutcomeConfidenceBuckets;
  readonly byDecision: Record<string, OutcomeBucketStats>;
  readonly byInstrument: Record<string, OutcomeBucketStats>;
  readonly historicalAccuracyReady: boolean;
  readonly learningReady: boolean;
}


export type MarketSnapshotDataQuality = "OK" | "LIVE" | "FRESH" | "DELAYED" | "STALE" | "INVALID" | "UNAVAILABLE";

export interface DecisionMarketSnapshotRecord {
  readonly snapshotId: string;
  readonly instrument: string;
  readonly observedAt: string;
  readonly price: number | null;
  readonly sourceTimestamp: string | null;
  readonly providerAlias: string;
  readonly dataQuality: MarketSnapshotDataQuality;
  readonly freshnessMs: number | null;
  readonly verified: boolean;
  readonly persistedAt: string;
  readonly metadataVersion: string;
}

export type DecisionMarketSnapshotWriteStatus = "STORED" | "DUPLICATE" | "CONFLICT" | "REJECTED" | "UNAVAILABLE";

export interface DecisionMarketSnapshotWriteResult {
  readonly ok: boolean;
  readonly snapshotId: string;
  readonly status: DecisionMarketSnapshotWriteStatus;
  readonly reason?: string;
}

export interface FindVerifiedMarketSnapshotInput {
  readonly instrument: string;
  readonly evaluationTimestamp: string;
  readonly maximumAllowedDistanceMs: number;
  readonly providerAlias?: string;
}

export interface DecisionMarketSnapshotStats {
  readonly repositoryType: "IN_MEMORY" | "SUPABASE";
  readonly durability: "PROCESS_LIFETIME" | "DURABLE";
  readonly storedMarketSnapshots: number;
  readonly verifiedMarketSnapshots: number;
  readonly rejectedSnapshotCount: number;
  readonly oldestVerifiedSnapshot: string | null;
  readonly newestVerifiedSnapshot: string | null;
  readonly instrumentsCovered: readonly string[];
  readonly snapshotRepositoryCapacity: number;
  readonly lastSnapshotIngestedAt: string | null;
  readonly lastSnapshotRejectionReason: string | null;
  readonly schedulerSnapshotSource: "DECISION_HISTORY_MARKET_SNAPSHOT_REPOSITORY";
  readonly schedulerSnapshotReady: boolean;
}
export interface DecisionPersistenceRepository {
  save(record: DecisionPersistedRecord): Promise<void>;
  recordOutcome?(outcome: DecisionOutcomeRecord): Promise<DecisionOutcomeWriteResult>;
  getOutcome?(runId: string): DecisionOutcomeRecord | null;
  listOutcomes?(options?: { limit?: number; before?: string; after?: string }): readonly DecisionOutcomeRecord[];
  getOutcomeStats?(): DecisionOutcomeStats;
  resetOutcomesForTests?(): void;
  getDecisionRunById?(runId: string): DecisionPersistedRecord | null;
  listDecisionRuns?(options?: { limit?: number; before?: string; after?: string }): readonly DecisionPersistedRecord[];
  getDecisionHistoryStats?(): DecisionHistoryStats;
  resetDecisionHistoryForTests?(): void;
  recordMarketSnapshot?(snapshot: DecisionMarketSnapshotRecord): Promise<DecisionMarketSnapshotWriteResult>;
  getMarketSnapshot?(snapshotId: string): DecisionMarketSnapshotRecord | null;
  listMarketSnapshots?(options?: { limit?: number; before?: string; after?: string; verifiedOnly?: boolean }): readonly DecisionMarketSnapshotRecord[];
  findVerifiedSnapshot?(input: FindVerifiedMarketSnapshotInput): DecisionMarketSnapshotRecord | null;
  getMarketSnapshotStats?(): DecisionMarketSnapshotStats;
  resetMarketSnapshotsForTests?(): void;
}

export interface PersistCompletedDecisionResult {
  readonly ok: boolean;
  readonly runId: string;
  readonly reason?: string;
}


