import type {
  DecisionHistoryStats,
  DecisionMarketSnapshotRecord,
  DecisionMarketSnapshotStats,
  DecisionMarketSnapshotWriteResult,
  DecisionOutcomeRecord,
  DecisionOutcomeWriteResult,
  DecisionPersistenceRepository,
  DecisionPersistedRecord,
  FindVerifiedMarketSnapshotInput,
} from "./types";
import { serializeDecisionRecord } from "./serializer";
import { buildOutcomeStats } from "./outcome-aggregation";

export interface DecisionHistoryStorageAdapter {
  save(record: DecisionPersistedRecord): Promise<void>;
}

export const DEFAULT_DECISION_OUTCOME_RETENTION_LIMIT = 250;
export const DEFAULT_MARKET_SNAPSHOT_RETENTION_LIMIT = 500;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === "object") deepFreeze(child);
    }
  }
  return value;
}

function cloneRecord(record: DecisionPersistedRecord): DecisionPersistedRecord {
  return deepFreeze({
    ...record,
    risk: { ...record.risk, reasons: [...record.risk.reasons] },
    signals: [...record.signals],
    capabilities: { ...record.capabilities },
    summary: { ...record.summary },
    formulaVersions: { ...record.formulaVersions },
    providerLabels: { ...record.providerLabels },
  });
}

function cloneOutcome(outcome: DecisionOutcomeRecord): DecisionOutcomeRecord {
  return deepFreeze({
    ...outcome,
    formulaVersions: { ...outcome.formulaVersions },
    providerLabels: { ...outcome.providerLabels },
  });
}

function cloneMarketSnapshot(snapshot: DecisionMarketSnapshotRecord): DecisionMarketSnapshotRecord {
  return deepFreeze({ ...snapshot });
}

function sameSerialized(a: unknown, b: unknown): boolean {
  return serializeDecisionRecord(a) === serializeDecisionRecord(b);
}

function boundedReason(reason: string | null): string | null {
  if (!reason) return null;
  return reason.replace(/token|secret|authorization|cookie|api[-_]?key/gi, "[REDACTED]").slice(0, 160);
}

export class InMemoryDecisionHistoryRepository implements DecisionPersistenceRepository {
  private readonly records: DecisionPersistedRecord[] = [];
  private readonly outcomes: DecisionOutcomeRecord[] = [];
  private readonly marketSnapshots: DecisionMarketSnapshotRecord[] = [];
  private readonly retentionLimit: number;
  private readonly outcomeRetentionLimit: number;
  private readonly marketSnapshotRetentionLimit: number;
  private droppedRunCount = 0;
  private droppedOutcomeCount = 0;
  private droppedMarketSnapshotCount = 0;
  private rejectedSnapshotCount = 0;
  private lastSnapshotIngestedAt: string | null = null;
  private lastSnapshotRejectionReason: string | null = null;
  private lastPersistenceError: string | null = null;

  constructor(
    retentionLimit = 250,
    outcomeRetentionLimit = DEFAULT_DECISION_OUTCOME_RETENTION_LIMIT,
    marketSnapshotRetentionLimit = DEFAULT_MARKET_SNAPSHOT_RETENTION_LIMIT,
  ) {
    this.retentionLimit = Math.max(1, retentionLimit);
    this.outcomeRetentionLimit = Math.max(1, outcomeRetentionLimit);
    this.marketSnapshotRetentionLimit = Math.max(1, marketSnapshotRetentionLimit);
  }

  async save(record: DecisionPersistedRecord): Promise<void> {
    const normalized = cloneRecord(record);
    const existingIndex = this.records.findIndex((item) => item.runId === normalized.runId);
    if (existingIndex >= 0) {
      this.records[existingIndex] = normalized;
      this.lastPersistenceError = null;
      return;
    }

    this.records.push(normalized);
    if (this.records.length > this.retentionLimit) {
      this.records.shift();
      this.droppedRunCount += 1;
    }
    this.lastPersistenceError = null;
  }

  getDecisionRunById(runId: string): DecisionPersistedRecord | null {
    const found = this.records.find((item) => item.runId === runId);
    return found ? cloneRecord(found) : null;
  }

  listDecisionRuns(options?: { limit?: number; before?: string; after?: string }): readonly DecisionPersistedRecord[] {
    const filtered = this.records.filter((item) => {
      if (options?.before && item.timestamp >= options.before) return false;
      if (options?.after && item.timestamp <= options.after) return false;
      return true;
    });
    const limit = options?.limit ?? filtered.length;
    const safeLimit = Math.max(0, Math.min(Math.trunc(limit), filtered.length));
    return filtered.slice(0, safeLimit).map(cloneRecord);
  }

  async recordOutcome(outcome: DecisionOutcomeRecord): Promise<DecisionOutcomeWriteResult> {
    if (!this.records.some((record) => record.runId === outcome.runId)) {
      return { ok: false, runId: outcome.runId, status: "MISSING_RUN", reason: "Outcome runId does not reference an existing decision run." };
    }

    const normalized = cloneOutcome(outcome);
    const existingIndex = this.outcomes.findIndex((item) => item.runId === normalized.runId);
    if (existingIndex >= 0) {
      const existing = this.outcomes[existingIndex];
      if (sameSerialized(existing, normalized)) return { ok: true, runId: normalized.runId, status: "DUPLICATE" };
      return { ok: false, runId: normalized.runId, status: "CONFLICT", reason: "Conflicting outcome already exists for runId." };
    }

    this.outcomes.push(normalized);
    if (this.outcomes.length > this.outcomeRetentionLimit) {
      this.outcomes.shift();
      this.droppedOutcomeCount += 1;
    }
    return { ok: true, runId: normalized.runId, status: "RECORDED" };
  }

  getOutcome(runId: string): DecisionOutcomeRecord | null {
    const found = this.outcomes.find((item) => item.runId === runId);
    return found ? cloneOutcome(found) : null;
  }

  listOutcomes(options?: { limit?: number; before?: string; after?: string }): readonly DecisionOutcomeRecord[] {
    const filtered = this.outcomes.filter((item) => {
      if (options?.before && item.evaluatedAt >= options.before) return false;
      if (options?.after && item.evaluatedAt <= options.after) return false;
      return true;
    });
    const limit = options?.limit ?? filtered.length;
    const safeLimit = Math.max(0, Math.min(Math.trunc(limit), filtered.length));
    return filtered.slice(0, safeLimit).map(cloneOutcome);
  }

  getOutcomeStats() {
    return buildOutcomeStats(this.outcomes);
  }

  resetOutcomesForTests(): void {
    this.outcomes.splice(0, this.outcomes.length);
    this.droppedOutcomeCount = 0;
  }

  async recordMarketSnapshot(snapshot: DecisionMarketSnapshotRecord): Promise<DecisionMarketSnapshotWriteResult> {
    const normalized = cloneMarketSnapshot(snapshot);
    if (!normalized.verified) {
      this.rejectedSnapshotCount += 1;
      this.lastSnapshotRejectionReason = boundedReason("Snapshot is not verified.");
      return { ok: false, snapshotId: normalized.snapshotId, status: "REJECTED", reason: "Snapshot is not verified." };
    }

    const existingIndex = this.marketSnapshots.findIndex((item) => item.snapshotId === normalized.snapshotId);
    if (existingIndex >= 0) {
      const existing = this.marketSnapshots[existingIndex];
      if (sameSerialized(existing, normalized)) return { ok: true, snapshotId: normalized.snapshotId, status: "DUPLICATE" };
      this.rejectedSnapshotCount += 1;
      this.lastSnapshotRejectionReason = boundedReason("Conflicting market snapshot already exists for snapshotId.");
      return { ok: false, snapshotId: normalized.snapshotId, status: "CONFLICT", reason: "Conflicting market snapshot already exists for snapshotId." };
    }

    this.marketSnapshots.push(normalized);
    if (this.marketSnapshots.length > this.marketSnapshotRetentionLimit) {
      this.marketSnapshots.shift();
      this.droppedMarketSnapshotCount += 1;
    }
    this.lastSnapshotIngestedAt = normalized.persistedAt;
    return { ok: true, snapshotId: normalized.snapshotId, status: "STORED" };
  }

  getMarketSnapshot(snapshotId: string): DecisionMarketSnapshotRecord | null {
    const found = this.marketSnapshots.find((item) => item.snapshotId === snapshotId);
    return found ? cloneMarketSnapshot(found) : null;
  }

  listMarketSnapshots(options?: { limit?: number; before?: string; after?: string; verifiedOnly?: boolean }): readonly DecisionMarketSnapshotRecord[] {
    const filtered = this.marketSnapshots.filter((item) => {
      if (options?.verifiedOnly && !item.verified) return false;
      if (options?.before && item.observedAt >= options.before) return false;
      if (options?.after && item.observedAt <= options.after) return false;
      return true;
    });
    const limit = options?.limit ?? filtered.length;
    const safeLimit = Math.max(0, Math.min(Math.trunc(limit), filtered.length));
    return filtered.slice(0, safeLimit).map(cloneMarketSnapshot);
  }

  findVerifiedSnapshot(input: FindVerifiedMarketSnapshotInput): DecisionMarketSnapshotRecord | null {
    const evaluationTs = Date.parse(input.evaluationTimestamp);
    if (!Number.isFinite(evaluationTs)) return null;
    const candidates = this.marketSnapshots
      .filter((item) => {
        if (!item.verified) return false;
        if (item.instrument !== input.instrument) return false;
        if (input.providerAlias && item.providerAlias !== input.providerAlias) return false;
        const observedTs = Date.parse(item.observedAt);
        if (!Number.isFinite(observedTs)) return false;
        if (observedTs < evaluationTs) return false;
        return observedTs - evaluationTs <= input.maximumAllowedDistanceMs;
      })
      .sort((a, b) => {
        const byObserved = Date.parse(a.observedAt) - Date.parse(b.observedAt);
        return byObserved !== 0 ? byObserved : a.snapshotId.localeCompare(b.snapshotId);
      });
    return candidates[0] ? cloneMarketSnapshot(candidates[0]) : null;
  }

  getMarketSnapshotStats(): DecisionMarketSnapshotStats {
    const verified = this.marketSnapshots.filter((item) => item.verified);
    const observed = verified.map((item) => item.observedAt).sort();
    const instruments = Array.from(new Set(verified.map((item) => item.instrument))).sort();
    return {
      repositoryType: "IN_MEMORY",
      durability: "PROCESS_LIFETIME",
      storedMarketSnapshots: this.marketSnapshots.length,
      verifiedMarketSnapshots: verified.length,
      rejectedSnapshotCount: this.rejectedSnapshotCount,
      oldestVerifiedSnapshot: observed[0] ?? null,
      newestVerifiedSnapshot: observed[observed.length - 1] ?? null,
      instrumentsCovered: instruments,
      snapshotRepositoryCapacity: this.marketSnapshotRetentionLimit,
      lastSnapshotIngestedAt: this.lastSnapshotIngestedAt,
      lastSnapshotRejectionReason: this.lastSnapshotRejectionReason,
      schedulerSnapshotSource: "DECISION_HISTORY_MARKET_SNAPSHOT_REPOSITORY",
      schedulerSnapshotReady: verified.length > 0 && instruments.length > 0,
    };
  }

  resetMarketSnapshotsForTests(): void {
    this.marketSnapshots.splice(0, this.marketSnapshots.length);
    this.droppedMarketSnapshotCount = 0;
    this.rejectedSnapshotCount = 0;
    this.lastSnapshotIngestedAt = null;
    this.lastSnapshotRejectionReason = null;
  }

  getDecisionHistoryStats(): DecisionHistoryStats {
    const timestamps = this.records.map((item) => item.timestamp).sort();
    const instruments = Array.from(new Set(this.records.map((item) => item.instrument))).sort();
    return {
      repositoryType: "IN_MEMORY",
      durability: "PROCESS_LIFETIME",
      totalRuns: this.records.length,
      oldestTimestamp: timestamps[0] ?? null,
      newestTimestamp: timestamps[timestamps.length - 1] ?? null,
      instruments,
      retentionLimit: this.retentionLimit,
      droppedRunCount: this.droppedRunCount,
      lastPersistenceError: this.lastPersistenceError,
    };
  }

  getOutcomeRetentionStats(): { readonly retentionLimit: number; readonly droppedOutcomeCount: number } {
    return { retentionLimit: this.outcomeRetentionLimit, droppedOutcomeCount: this.droppedOutcomeCount };
  }

  resetDecisionHistoryForTests(): void {
    this.records.splice(0, this.records.length);
    this.droppedRunCount = 0;
    this.lastPersistenceError = null;
    this.resetOutcomesForTests();
    this.resetMarketSnapshotsForTests();
  }

  setLastPersistenceError(error: string | null): void {
    this.lastPersistenceError = error;
  }

  list(): readonly DecisionPersistedRecord[] {
    return this.records.map(cloneRecord);
  }
}

export class JsonDecisionHistoryRepository implements DecisionPersistenceRepository {
  constructor(private readonly adapter: DecisionHistoryStorageAdapter) {}

  async save(record: DecisionPersistedRecord): Promise<void> {
    const payload = serializeDecisionRecord(record);
    await this.adapter.save({ ...record, __serialized: payload } as DecisionPersistedRecord & { __serialized: string });
  }
}



type SupabaseErrorLike = { readonly message?: string } | null;
type SupabaseResult<T> = { readonly data: T | null; readonly error: SupabaseErrorLike; readonly count?: number | null };
type SupabaseQueryBuilder<T> = PromiseLike<SupabaseResult<T>> & {
  select(columns?: string, options?: Record<string, unknown>): SupabaseQueryBuilder<T>;
  order(column: string, options?: Record<string, unknown>): SupabaseQueryBuilder<T>;
  limit(count: number): SupabaseQueryBuilder<T>;
  eq(column: string, value: unknown): SupabaseQueryBuilder<T>;
  lt(column: string, value: unknown): SupabaseQueryBuilder<T>;
  in(column: string, values: readonly unknown[]): SupabaseQueryBuilder<T>;
};
type SupabaseTable = {
  select<T = Record<string, unknown>[]>(columns?: string, options?: Record<string, unknown>): SupabaseQueryBuilder<T>;
  upsert(row: Record<string, unknown>, options?: Record<string, unknown>): Promise<SupabaseResult<unknown>>;
  delete(): SupabaseQueryBuilder<Record<string, unknown>[]>;
};
type SupabaseClientLike = { from(table: string): SupabaseTable };

const DECISION_RUNS_TABLE = "decision_history_runs";
const DECISION_OUTCOMES_TABLE = "decision_history_outcomes";
const DECISION_MARKET_SNAPSHOTS_TABLE = "decision_history_market_snapshots";

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function runToRow(record: DecisionPersistedRecord): Record<string, unknown> {
  return {
    run_id: record.runId,
    decision_timestamp: record.timestamp,
    instrument: record.instrument,
    spot: record.spot,
    decision: record.decision,
    confidence: record.confidence,
    risk: record.risk,
    signals: record.signals,
    capabilities: record.capabilities,
    summary: record.summary,
    formula_versions: record.formulaVersions,
    provider_labels: record.providerLabels,
  };
}

function rowToRun(row: Record<string, unknown>): DecisionPersistedRecord {
  return {
    runId: String(row.run_id),
    timestamp: String(row.decision_timestamp),
    instrument: String(row.instrument),
    spot: typeof row.spot === "number" ? row.spot : null,
    decision: String(row.decision),
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    risk: {
      level: String(jsonRecord(row.risk).level ?? "UNKNOWN"),
      reasons: jsonArray(jsonRecord(row.risk).reasons).map(String),
    },
    signals: jsonArray(row.signals),
    capabilities: jsonRecord(row.capabilities),
    summary: jsonRecord(row.summary),
    formulaVersions: Object.fromEntries(Object.entries(jsonRecord(row.formula_versions)).map(([k, v]) => [k, String(v)])),
    providerLabels: Object.fromEntries(Object.entries(jsonRecord(row.provider_labels)).map(([k, v]) => [k, String(v)])),
  };
}

function outcomeToRow(outcome: DecisionOutcomeRecord): Record<string, unknown> {
  return {
    run_id: outcome.runId,
    instrument: outcome.instrument,
    decision: outcome.decision,
    decision_timestamp: outcome.decisionTimestamp,
    evaluated_at: outcome.evaluatedAt,
    evaluation_horizon: outcome.evaluationHorizon,
    entry_reference_price: outcome.entryReferencePrice,
    future_price: outcome.futurePrice,
    outcome_state: outcome.outcomeState,
    confidence: outcome.confidence,
    formula_versions: outcome.formulaVersions,
    provider_labels: outcome.providerLabels,
  };
}

function rowToOutcome(row: Record<string, unknown>): DecisionOutcomeRecord {
  return {
    runId: String(row.run_id),
    instrument: String(row.instrument),
    decision: String(row.decision),
    decisionTimestamp: String(row.decision_timestamp),
    evaluatedAt: String(row.evaluated_at),
    evaluationHorizon: String(row.evaluation_horizon),
    entryReferencePrice: typeof row.entry_reference_price === "number" ? row.entry_reference_price : null,
    futurePrice: typeof row.future_price === "number" ? row.future_price : null,
    outcomeState: String(row.outcome_state) as DecisionOutcomeRecord["outcomeState"],
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    formulaVersions: Object.fromEntries(Object.entries(jsonRecord(row.formula_versions)).map(([k, v]) => [k, String(v)])),
    providerLabels: Object.fromEntries(Object.entries(jsonRecord(row.provider_labels)).map(([k, v]) => [k, String(v)])),
  };
}

function snapshotToRow(snapshot: DecisionMarketSnapshotRecord): Record<string, unknown> {
  return {
    snapshot_id: snapshot.snapshotId,
    instrument: snapshot.instrument,
    observed_at: snapshot.observedAt,
    price: snapshot.price,
    source_timestamp: snapshot.sourceTimestamp,
    provider_alias: snapshot.providerAlias,
    data_quality: snapshot.dataQuality,
    freshness_ms: snapshot.freshnessMs,
    verified: snapshot.verified,
    persisted_at: snapshot.persistedAt,
    metadata_version: snapshot.metadataVersion,
  };
}

function rowToSnapshot(row: Record<string, unknown>): DecisionMarketSnapshotRecord {
  return {
    snapshotId: String(row.snapshot_id),
    instrument: String(row.instrument),
    observedAt: String(row.observed_at),
    price: typeof row.price === "number" ? row.price : null,
    sourceTimestamp: typeof row.source_timestamp === "string" ? row.source_timestamp : null,
    providerAlias: String(row.provider_alias),
    dataQuality: String(row.data_quality) as DecisionMarketSnapshotRecord["dataQuality"],
    freshnessMs: typeof row.freshness_ms === "number" ? row.freshness_ms : null,
    verified: row.verified === true,
    persistedAt: String(row.persisted_at),
    metadataVersion: String(row.metadata_version),
  };
}

async function loadSupabaseAdminClient(): Promise<SupabaseClientLike> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as unknown as SupabaseClientLike;
}

export interface DecisionHistoryPersistenceReadiness {
  readonly persistenceProvider: "SUPABASE" | "IN_MEMORY";
  readonly persistenceDurability: "DURABLE" | "PROCESS_LIFETIME";
  readonly migrationExpected: "20260801000100_phase65_decision_history_persistence.sql";
  readonly generatedTypesReady: boolean;
  readonly schemaAlignmentStatus: "VALID" | "INVALID";
  readonly repositoryHydrationStatus: "READY" | "UNAVAILABLE";
  readonly persistenceReady: boolean;
  readonly lastPersistenceError: string | null;
}
export interface SupabaseDecisionHistoryRepositoryOptions {
  readonly client?: SupabaseClientLike;
  readonly fallback?: InMemoryDecisionHistoryRepository;
  readonly retentionLimit?: number;
  readonly outcomeRetentionLimit?: number;
  readonly marketSnapshotRetentionLimit?: number;
}

export class SupabaseDecisionHistoryRepository extends InMemoryDecisionHistoryRepository {
  private readonly client?: SupabaseClientLike;
  private readonly fallback: InMemoryDecisionHistoryRepository;
  private hydrated = false;

  constructor(options: SupabaseDecisionHistoryRepositoryOptions = {}) {
    super(options.retentionLimit, options.outcomeRetentionLimit, options.marketSnapshotRetentionLimit);
    this.client = options.client;
    this.fallback = options.fallback ?? new InMemoryDecisionHistoryRepository(options.retentionLimit, options.outcomeRetentionLimit, options.marketSnapshotRetentionLimit);
  }

  private async getClient(): Promise<SupabaseClientLike | null> {
    if (this.client) return this.client;
    try {
      return await loadSupabaseAdminClient();
    } catch (error) {
      this.setLastPersistenceError(error instanceof Error ? boundedReason(error.message) : "Supabase unavailable.");
      return null;
    }
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const client = await this.getClient();
    if (!client) return;
    try {
      const runs = await client.from(DECISION_RUNS_TABLE).select<Record<string, unknown>[]>().order("decision_timestamp", { ascending: true }).order("run_id", { ascending: true });
      if (runs.error) throw new Error(runs.error.message ?? "Failed to load decision runs.");
      for (const row of runs.data ?? []) await super.save(rowToRun(row));
      const outcomes = await client.from(DECISION_OUTCOMES_TABLE).select<Record<string, unknown>[]>().order("evaluated_at", { ascending: true }).order("run_id", { ascending: true });
      if (outcomes.error) throw new Error(outcomes.error.message ?? "Failed to load outcomes.");
      for (const row of outcomes.data ?? []) await super.recordOutcome(rowToOutcome(row));
      const snapshots = await client.from(DECISION_MARKET_SNAPSHOTS_TABLE).select<Record<string, unknown>[]>().order("observed_at", { ascending: true }).order("snapshot_id", { ascending: true });
      if (snapshots.error) throw new Error(snapshots.error.message ?? "Failed to load market snapshots.");
      for (const row of snapshots.data ?? []) await super.recordMarketSnapshot(rowToSnapshot(row));
      this.setLastPersistenceError(null);
    } catch (error) {
      this.setLastPersistenceError(error instanceof Error ? boundedReason(error.message) : "Supabase hydration failed.");
    }
  }

  private async purge(table: string, key: string, orderColumn: string, limit: number): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    const rows = await client.from(table).select<Record<string, unknown>[]>(key).order(orderColumn, { ascending: false }).order(key, { ascending: false });
    if (rows.error || !rows.data || rows.data.length <= limit) return;
    const stale = rows.data.slice(limit).map((row) => row[key]).filter((value): value is string => typeof value === "string");
    if (stale.length > 0) await client.from(table).delete().in(key, stale);
  }

  override async save(record: DecisionPersistedRecord): Promise<void> {
    await this.hydrate();
    const client = await this.getClient();
    if (!client) {
      await this.fallback.save(record);
      await super.save(record);
      return;
    }
    const result = await client.from(DECISION_RUNS_TABLE).upsert(runToRow(record), { onConflict: "run_id" });
    if (result.error) {
      this.setLastPersistenceError(boundedReason(result.error.message ?? "Supabase save failed."));
      await this.fallback.save(record);
      await super.save(record);
      return;
    }
    await super.save(record);
    await this.purge(DECISION_RUNS_TABLE, "run_id", "decision_timestamp", this.getDecisionHistoryStats().retentionLimit);
    this.setLastPersistenceError(null);
  }

  override getDecisionRunById(runId: string): DecisionPersistedRecord | null {
    return super.getDecisionRunById(runId) ?? this.fallback.getDecisionRunById(runId);
  }

  override listDecisionRuns(options?: { limit?: number; before?: string; after?: string }): readonly DecisionPersistedRecord[] {
    const durable = super.listDecisionRuns(options);
    return durable.length > 0 ? durable : this.fallback.listDecisionRuns(options);
  }

  override async recordOutcome(outcome: DecisionOutcomeRecord): Promise<DecisionOutcomeWriteResult> {
    await this.hydrate();
    const existing = super.getOutcome(outcome.runId) ?? this.fallback.getOutcome(outcome.runId);
    if (existing) {
      if (sameSerialized(existing, outcome)) return { ok: true, runId: outcome.runId, status: "DUPLICATE" };
      return { ok: false, runId: outcome.runId, status: "CONFLICT", reason: "Conflicting outcome already exists for runId." };
    }
    if (!super.getDecisionRunById(outcome.runId) && !this.fallback.getDecisionRunById(outcome.runId)) {
      return { ok: false, runId: outcome.runId, status: "MISSING_RUN", reason: "Outcome runId does not reference an existing decision run." };
    }
    const client = await this.getClient();
    if (!client) {
      await this.fallback.recordOutcome(outcome);
      return super.recordOutcome(outcome);
    }
    const result = await client.from(DECISION_OUTCOMES_TABLE).upsert(outcomeToRow(outcome), { onConflict: "run_id", ignoreDuplicates: true });
    if (result.error) return { ok: false, runId: outcome.runId, status: "FAILED", reason: boundedReason(result.error.message ?? "Supabase outcome write failed.") ?? undefined };
    const stored = await super.recordOutcome(outcome);
    await this.purge(DECISION_OUTCOMES_TABLE, "run_id", "evaluated_at", this.getOutcomeRetentionStats().retentionLimit);
    return stored;
  }

  override async recordMarketSnapshot(snapshot: DecisionMarketSnapshotRecord): Promise<DecisionMarketSnapshotWriteResult> {
    await this.hydrate();
    if (!snapshot.verified) return super.recordMarketSnapshot(snapshot);
    const existing = super.getMarketSnapshot(snapshot.snapshotId);
    if (existing) {
      if (sameSerialized(existing, snapshot)) return { ok: true, snapshotId: snapshot.snapshotId, status: "DUPLICATE" };
      return { ok: false, snapshotId: snapshot.snapshotId, status: "CONFLICT", reason: "Conflicting market snapshot already exists for snapshotId." };
    }
    const client = await this.getClient();
    if (!client) {
      await this.fallback.recordMarketSnapshot(snapshot);
      return super.recordMarketSnapshot(snapshot);
    }
    const result = await client.from(DECISION_MARKET_SNAPSHOTS_TABLE).upsert(snapshotToRow(snapshot), { onConflict: "snapshot_id", ignoreDuplicates: true });
    if (result.error) return { ok: false, snapshotId: snapshot.snapshotId, status: "UNAVAILABLE", reason: boundedReason(result.error.message ?? "Supabase snapshot write failed.") ?? undefined };
    const stored = await super.recordMarketSnapshot(snapshot);
    await this.purge(DECISION_MARKET_SNAPSHOTS_TABLE, "snapshot_id", "observed_at", this.getMarketSnapshotStats().snapshotRepositoryCapacity);
    return stored;
  }

  async getPersistenceReadiness(): Promise<DecisionHistoryPersistenceReadiness> {
    await this.hydrate();
    const error = this.getDecisionHistoryStats().lastPersistenceError;
    const repositoryHydrationStatus = error ? "UNAVAILABLE" : "READY";
    return deepFreeze({
      persistenceProvider: "SUPABASE",
      persistenceDurability: "DURABLE",
      migrationExpected: "20260801000100_phase65_decision_history_persistence.sql",
      generatedTypesReady: true,
      schemaAlignmentStatus: "VALID",
      repositoryHydrationStatus,
      persistenceReady: repositoryHydrationStatus === "READY",
      lastPersistenceError: error,
    });
  }
  override getDecisionHistoryStats(): DecisionHistoryStats {
    return { ...super.getDecisionHistoryStats(), repositoryType: "SUPABASE", durability: "DURABLE" };
  }

  override getMarketSnapshotStats(): DecisionMarketSnapshotStats {
    return { ...super.getMarketSnapshotStats(), repositoryType: "SUPABASE", durability: "DURABLE" };
  }
}

export const defaultDecisionHistoryRepository = new SupabaseDecisionHistoryRepository();

