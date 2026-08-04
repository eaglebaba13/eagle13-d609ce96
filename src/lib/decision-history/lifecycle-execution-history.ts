import { serializeDecisionRecord } from "./serializer";

export type LifecycleExecutionStatus = "SUCCESS" | "PARTIAL" | "NO_WORK" | "DEGRADED" | "FAILED";

export type LifecycleFailureCode =
  | "PROVIDER_UNAVAILABLE"
  | "SNAPSHOT_REJECTED"
  | "NO_VERIFIED_SNAPSHOT"
  | "REPOSITORY_UNAVAILABLE"
  | "EVALUATOR_FAILED"
  | "SCHEDULER_BUSY"
  | "MARKET_CLOSED"
  | "UNKNOWN";

export interface LifecycleExecutionSummary {
  readonly executionId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly snapshotsAttempted: number;
  readonly snapshotsStored: number;
  readonly eligibleRuns: number;
  readonly evaluatedRuns: number;
  readonly skippedRuns: number;
  readonly pendingRuns: number;
  readonly failedRuns: number;
  readonly status: LifecycleExecutionStatus;
  readonly safeWarnings: readonly string[];
}

export interface LifecycleExecutionStats {
  readonly repositoryType: "IN_MEMORY" | "SUPABASE";
  readonly durability: "PROCESS_LIFETIME" | "DURABLE";
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly partialExecutions: number;
  readonly failedExecutions: number;
  readonly lastExecutionAt: string | null;
  readonly lastExecutionDurationMs: number | null;
  readonly lastExecutionResult: LifecycleExecutionStatus | null;
  readonly lastSnapshotAttemptCount: number;
  readonly lastSnapshotStoredCount: number;
  readonly lastEligibleRunCount: number;
  readonly lastEvaluatedRunCount: number;
  readonly lastPendingRunCount: number;
  readonly lastSafeWarning: string | null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === "object") deepFreeze(child);
    }
  }
  return value;
}

function sanitizeWarning(warning: string): string {
  return warning.replace(/token|secret|authorization|cookie|api[-_]?key|bearer/gi, "[REDACTED]").slice(0, 160);
}

function cloneExecution(summary: LifecycleExecutionSummary): LifecycleExecutionSummary {
  return deepFreeze({ ...summary, safeWarnings: summary.safeWarnings.map(sanitizeWarning) });
}

export class InMemoryLifecycleExecutionRepository {
  private readonly records: LifecycleExecutionSummary[] = [];

  constructor(private readonly retentionLimit = 100) {}

  recordExecution(summary: LifecycleExecutionSummary): LifecycleExecutionSummary {
    const normalized = cloneExecution(summary);
    const existingIndex = this.records.findIndex((item) => item.executionId === normalized.executionId);
    if (existingIndex >= 0) {
      if (serializeDecisionRecord(this.records[existingIndex]) === serializeDecisionRecord(normalized)) {
        return cloneExecution(this.records[existingIndex]);
      }
      return cloneExecution(this.records[existingIndex]);
    }
    this.records.push(normalized);
    if (this.records.length > this.retentionLimit) this.records.shift();
    return cloneExecution(normalized);
  }

  getLastExecution(): LifecycleExecutionSummary | null {
    const last = this.records[this.records.length - 1];
    return last ? cloneExecution(last) : null;
  }

  listExecutions(limit = this.records.length): readonly LifecycleExecutionSummary[] {
    const safeLimit = Math.max(0, Math.min(Math.trunc(limit), this.records.length));
    return this.records.slice(-safeLimit).map(cloneExecution);
  }

  getExecutionStats(): LifecycleExecutionStats {
    const last = this.getLastExecution();
    return {
      repositoryType: "IN_MEMORY",
      durability: "PROCESS_LIFETIME",
      totalExecutions: this.records.length,
      successfulExecutions: this.records.filter((item) => item.status === "SUCCESS").length,
      partialExecutions: this.records.filter((item) => item.status === "PARTIAL" || item.status === "DEGRADED").length,
      failedExecutions: this.records.filter((item) => item.status === "FAILED").length,
      lastExecutionAt: last?.completedAt ?? null,
      lastExecutionDurationMs: last?.durationMs ?? null,
      lastExecutionResult: last?.status ?? null,
      lastSnapshotAttemptCount: last?.snapshotsAttempted ?? 0,
      lastSnapshotStoredCount: last?.snapshotsStored ?? 0,
      lastEligibleRunCount: last?.eligibleRuns ?? 0,
      lastEvaluatedRunCount: last?.evaluatedRuns ?? 0,
      lastPendingRunCount: last?.pendingRuns ?? 0,
      lastSafeWarning: last?.safeWarnings[last.safeWarnings.length - 1] ?? null,
    };
  }

  resetExecutionsForTests(): void {
    this.records.splice(0, this.records.length);
  }
}



type SupabaseExecutionErrorLike = { readonly message?: string } | null;
type SupabaseExecutionResult<T> = { readonly data: T | null; readonly error: SupabaseExecutionErrorLike };
type SupabaseExecutionQuery<T> = PromiseLike<SupabaseExecutionResult<T>> & {
  select(columns?: string, options?: Record<string, unknown>): SupabaseExecutionQuery<T>;
  order(column: string, options?: Record<string, unknown>): SupabaseExecutionQuery<T>;
  limit(count: number): SupabaseExecutionQuery<T>;
  in(column: string, values: readonly unknown[]): SupabaseExecutionQuery<T>;
};
type SupabaseExecutionTable = {
  select<T = Record<string, unknown>[]>(columns?: string, options?: Record<string, unknown>): SupabaseExecutionQuery<T>;
  upsert(row: Record<string, unknown>, options?: Record<string, unknown>): Promise<SupabaseExecutionResult<unknown>>;
  delete(): SupabaseExecutionQuery<Record<string, unknown>[]>;
};
type SupabaseExecutionClient = { from(table: string): SupabaseExecutionTable };

const EXECUTIONS_TABLE = "decision_history_lifecycle_executions";

function executionToRow(summary: LifecycleExecutionSummary): Record<string, unknown> {
  return {
    execution_id: summary.executionId,
    started_at: summary.startedAt,
    completed_at: summary.completedAt,
    duration_ms: summary.durationMs,
    snapshots_attempted: summary.snapshotsAttempted,
    snapshots_stored: summary.snapshotsStored,
    eligible_runs: summary.eligibleRuns,
    evaluated_runs: summary.evaluatedRuns,
    skipped_runs: summary.skippedRuns,
    pending_runs: summary.pendingRuns,
    failed_runs: summary.failedRuns,
    status: summary.status,
    safe_warnings: summary.safeWarnings,
  };
}

function rowToExecution(row: Record<string, unknown>): LifecycleExecutionSummary {
  return {
    executionId: String(row.execution_id),
    startedAt: String(row.started_at),
    completedAt: String(row.completed_at),
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : 0,
    snapshotsAttempted: typeof row.snapshots_attempted === "number" ? row.snapshots_attempted : 0,
    snapshotsStored: typeof row.snapshots_stored === "number" ? row.snapshots_stored : 0,
    eligibleRuns: typeof row.eligible_runs === "number" ? row.eligible_runs : 0,
    evaluatedRuns: typeof row.evaluated_runs === "number" ? row.evaluated_runs : 0,
    skippedRuns: typeof row.skipped_runs === "number" ? row.skipped_runs : 0,
    pendingRuns: typeof row.pending_runs === "number" ? row.pending_runs : 0,
    failedRuns: typeof row.failed_runs === "number" ? row.failed_runs : 0,
    status: String(row.status) as LifecycleExecutionStatus,
    safeWarnings: Array.isArray(row.safe_warnings) ? row.safe_warnings.map(String) : [],
  };
}

async function loadSupabaseExecutionClient(): Promise<SupabaseExecutionClient> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as unknown as SupabaseExecutionClient;
}

export class SupabaseLifecycleExecutionRepository extends InMemoryLifecycleExecutionRepository {
  private hydrated = false;

  constructor(private readonly client?: SupabaseExecutionClient, retentionLimit = 100) {
    super(retentionLimit);
  }

  private async getClient(): Promise<SupabaseExecutionClient | null> {
    if (this.client) return this.client;
    try {
      return await loadSupabaseExecutionClient();
    } catch {
      return null;
    }
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const client = await this.getClient();
    if (!client) return;
    const rows = await client.from(EXECUTIONS_TABLE).select<Record<string, unknown>[]>().order("completed_at", { ascending: true }).order("execution_id", { ascending: true });
    if (rows.error) return;
    for (const row of rows.data ?? []) super.recordExecution(rowToExecution(row));
  }

  private async persistExecution(summary: LifecycleExecutionSummary): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    await client.from(EXECUTIONS_TABLE).upsert(executionToRow(summary), { onConflict: "execution_id", ignoreDuplicates: true });
  }

  override recordExecution(summary: LifecycleExecutionSummary): LifecycleExecutionSummary {
    const stored = super.recordExecution(summary);
    void this.persistExecution(stored).catch(() => {});
    return stored;
  }

  async recordExecutionForReadiness(summary: LifecycleExecutionSummary): Promise<LifecycleExecutionSummary> {
    const stored = super.recordExecution(summary);
    await this.persistExecution(stored);
    return stored;
  }

  async hydrateForReadiness(): Promise<void> {
    await this.hydrate();
  }

  override getLastExecution(): LifecycleExecutionSummary | null {
    void this.hydrate();
    return super.getLastExecution();
  }

  override listExecutions(limit?: number): readonly LifecycleExecutionSummary[] {
    void this.hydrate();
    return super.listExecutions(limit);
  }

  override getExecutionStats(): LifecycleExecutionStats {
    void this.hydrate();
    return { ...super.getExecutionStats(), repositoryType: "SUPABASE", durability: "DURABLE" };
  }
}

export const defaultLifecycleExecutionRepository = new SupabaseLifecycleExecutionRepository();


