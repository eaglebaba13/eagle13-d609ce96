import { describe, expect, it } from "vitest";
import { InMemoryDecisionHistoryRepository, SupabaseDecisionHistoryRepository } from "./repository";
import { SupabaseLifecycleExecutionRepository } from "./lifecycle-execution-history";
import type { DecisionMarketSnapshotRecord, DecisionPersistedRecord } from "./types";

class FakeQuery<T extends Record<string, unknown>[]> implements PromiseLike<{ data: T; error: null }> {
  private rows: Record<string, unknown>[];

  constructor(rows: Record<string, unknown>[]) {
    this.rows = [...rows];
  }

  select(): this { return this; }

  order(column: string, options?: { ascending?: boolean }): this {
    const dir = options?.ascending === false ? -1 : 1;
    this.rows.sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * dir);
    return this;
  }

  limit(count: number): this {
    this.rows = this.rows.slice(0, Math.max(0, count));
    return this;
  }

  eq(column: string, value: unknown): this {
    this.rows = this.rows.filter((row) => row[column] === value);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.rows = this.rows.filter((row) => String(row[column] ?? "") < String(value));
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    const set = new Set(values);
    this.rows = this.rows.filter((row) => set.has(row[column]));
    return this;
  }

  then<TResult1 = { data: T; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows as T, error: null }).then(onfulfilled ?? undefined);
  }
}

class FakeTable {
  constructor(private readonly rows: Map<string, Record<string, unknown>>, private readonly key: string) {}

  select<T extends Record<string, unknown>[] = Record<string, unknown>[]>(): FakeQuery<T> {
    return new FakeQuery<T>(Array.from(this.rows.values()));
  }

  async upsert(row: Record<string, unknown>): Promise<{ data: null; error: null }> {
    this.rows.set(String(row[this.key]), { ...row });
    return { data: null, error: null };
  }

  delete(): FakeQuery<Record<string, unknown>[]> {
    const rows = this.rows;
    const key = this.key;
    const query = new FakeQuery<Record<string, unknown>[]>(Array.from(this.rows.values()));
    const originalIn = query.in.bind(query);
    query.in = (column: string, values: readonly unknown[]) => {
      originalIn(column, values);
      if (column === key) for (const value of values) rows.delete(String(value));
      return query;
    };
    return query;
  }
}

class FakeSupabaseClient {
  readonly tables = new Map<string, Map<string, Record<string, unknown>>>();

  from(name: string): FakeTable {
    const key = name.includes("market_snapshots") ? "snapshot_id" : name.includes("lifecycle") ? "execution_id" : "run_id";
    let rows = this.tables.get(name);
    if (!rows) {
      rows = new Map();
      this.tables.set(name, rows);
    }
    return new FakeTable(rows, key);
  }
}

function record(runId: string): DecisionPersistedRecord {
  return {
    runId,
    timestamp: `2026-07-30T10:00:0${runId.endsWith("2") ? 2 : 1}.000Z`,
    instrument: "NIFTY50",
    spot: 24000,
    decision: "BUY_CE",
    confidence: 80,
    risk: { level: "LOW", reasons: [] },
    signals: [],
    capabilities: {},
    summary: { evaluationHorizon: "30m" },
    formulaVersions: { decision: "decision@1.0.0" },
    providerLabels: { market: "UPSTOX" },
  };
}

function snapshot(snapshotId: string): DecisionMarketSnapshotRecord {
  return {
    snapshotId,
    instrument: "NIFTY50",
    observedAt: "2026-07-30T10:30:00.000Z",
    price: 24080,
    sourceTimestamp: "2026-07-30T10:30:00.000Z",
    providerAlias: "upstox-historical-v1",
    dataQuality: "OK",
    freshnessMs: 0,
    verified: true,
    persistedAt: "2026-07-30T10:30:00.000Z",
    metadataVersion: "DECISION_MARKET_SNAPSHOT_V1",
  };
}

describe("Supabase decision-history repository", () => {
  it("persists, hydrates, and preserves immutable deterministic reads", async () => {
    const client = new FakeSupabaseClient();
    const first = new SupabaseDecisionHistoryRepository({ client: client as never });
    await first.save(record("durable-1"));

    const second = new SupabaseDecisionHistoryRepository({ client: client as never });
    await second.save(record("durable-2"));
    expect(second.listDecisionRuns().map((item) => item.runId)).toEqual(["durable-1", "durable-2"]);
    expect(second.getDecisionHistoryStats().repositoryType).toBe("SUPABASE");
    expect(second.getDecisionHistoryStats().durability).toBe("DURABLE");

    const stored = second.getDecisionRunById("durable-1");
    expect(() => {
      (stored as { summary: Record<string, unknown> }).summary.x = 1;
    }).toThrow();
  });

  it("persists outcomes and verified market snapshots idempotently", async () => {
    const client = new FakeSupabaseClient();
    const repo = new SupabaseDecisionHistoryRepository({ client: client as never });
    await repo.save(record("durable-outcome"));
    const outcome = {
      runId: "durable-outcome",
      instrument: "NIFTY50",
      decision: "BUY_CE",
      decisionTimestamp: "2026-07-30T10:00:00.000Z",
      evaluatedAt: "2026-07-30T10:30:00.000Z",
      evaluationHorizon: "30m",
      entryReferencePrice: 24000,
      futurePrice: 24080,
      outcomeState: "WIN" as const,
      confidence: 80,
      formulaVersions: { decision: "decision@1.0.0" },
      providerLabels: { market: "UPSTOX" },
    };
    expect((await repo.recordOutcome(outcome)).status).toBe("RECORDED");
    expect((await repo.recordOutcome(outcome)).status).toBe("DUPLICATE");
    expect(repo.getOutcome("durable-outcome")?.outcomeState).toBe("WIN");

    expect((await repo.recordMarketSnapshot(snapshot("snap-1"))).status).toBe("STORED");
    expect((await repo.recordMarketSnapshot(snapshot("snap-1"))).status).toBe("DUPLICATE");
    expect(repo.findVerifiedSnapshot({ instrument: "NIFTY50", evaluationTimestamp: "2026-07-30T10:30:00.000Z", maximumAllowedDistanceMs: 1 })?.snapshotId).toBe("snap-1");
  });

  it("falls back safely when Supabase is unavailable", async () => {
    const fallback = new InMemoryDecisionHistoryRepository();
    const repo = new SupabaseDecisionHistoryRepository({ fallback });
    await repo.save(record("fallback-1"));
    expect(repo.getDecisionRunById("fallback-1")?.runId).toBe("fallback-1");
    expect(repo.getDecisionHistoryStats().repositoryType).toBe("SUPABASE");
    expect(String(repo.getDecisionHistoryStats().lastPersistenceError ?? "")).not.toMatch(/token|secret|authorization|cookie/i);
  });

  it("persists lifecycle execution history across repository recreation", async () => {
    const client = new FakeSupabaseClient();
    const first = new SupabaseLifecycleExecutionRepository(client as never);
    await first.recordExecutionForReadiness({
      executionId: "exec-1",
      startedAt: "2026-07-30T10:00:00.000Z",
      completedAt: "2026-07-30T10:00:01.000Z",
      durationMs: 1000,
      snapshotsAttempted: 1,
      snapshotsStored: 1,
      eligibleRuns: 1,
      evaluatedRuns: 1,
      skippedRuns: 0,
      pendingRuns: 0,
      failedRuns: 0,
      status: "SUCCESS",
      safeWarnings: [],
    });
    const second = new SupabaseLifecycleExecutionRepository(client as never);
    await second.hydrateForReadiness();
    expect(second.getExecutionStats().repositoryType).toBe("SUPABASE");
    expect(second.listExecutions(10).map((item) => item.executionId)).toEqual(["exec-1"]);
  });
});






