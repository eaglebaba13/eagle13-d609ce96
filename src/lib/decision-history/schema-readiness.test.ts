import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260801000100_phase65_decision_history_persistence.sql", "utf8");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const repository = readFileSync("src/lib/decision-history/repository.ts", "utf8");
const lifecycleRepository = readFileSync("src/lib/decision-history/lifecycle-execution-history.ts", "utf8");

describe("Phase 65 durable schema readiness", () => {
  it("defines rerunnable durable decision-history tables with primary keys and indexes", () => {
    for (const table of [
      "decision_history_runs",
      "decision_history_outcomes",
      "decision_history_market_snapshots",
      "decision_history_lifecycle_executions",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated`);
      expect(migration).toContain(`GRANT ALL ON public.${table} TO service_role`);
    }
    expect(migration).toMatch(/run_id text PRIMARY KEY/);
    expect(migration).toMatch(/snapshot_id text PRIMARY KEY/);
    expect(migration).toMatch(/execution_id text PRIMARY KEY/);
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS decision_history_runs_timestamp_idx");
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS decision_history_market_snapshots_lookup_idx");
  });

  it("uses JSONB only for structured safe payloads and never stores raw transport secrets", () => {
    expect(migration).toContain("risk jsonb");
    expect(migration).toContain("signals jsonb");
    expect(migration).toContain("safe_warnings jsonb");
    const tableDefinitionRegion = migration.split("ALTER TABLE public.decision_history_runs ENABLE ROW LEVEL SECURITY;")[0];
    expect(tableDefinitionRegion).not.toMatch(/authorization|cookie|access_token|refresh_token|api_key|service_role/i);
  });

  it("has generated-compatible Supabase table typings for all durable tables", () => {
    for (const table of [
      "decision_history_runs",
      "decision_history_outcomes",
      "decision_history_market_snapshots",
      "decision_history_lifecycle_executions",
    ]) {
      expect(types).toContain(`${table}: {`);
      expect(types).toMatch(new RegExp(`${table}: \\{[\\s\\S]*?Row: \\{[\\s\\S]*?Insert: \\{[\\s\\S]*?Update: \\{[\\s\\S]*?Relationships: \\[\\]`));
    }
    expect(types).toContain("source_timestamp: string | null");
    expect(types).toContain("future_price: number | null");
    expect(types).toContain("safe_warnings: Json");
  });

  it("aligns repository table names, conflict keys, and deterministic ordering with the migration", () => {
    expect(repository).toContain('const DECISION_RUNS_TABLE = "decision_history_runs"');
    expect(repository).toContain('const DECISION_OUTCOMES_TABLE = "decision_history_outcomes"');
    expect(repository).toContain('const DECISION_MARKET_SNAPSHOTS_TABLE = "decision_history_market_snapshots"');
    expect(lifecycleRepository).toContain('const EXECUTIONS_TABLE = "decision_history_lifecycle_executions"');
    expect(repository).toContain('onConflict: "run_id"');
    expect(repository).toContain('onConflict: "snapshot_id"');
    expect(lifecycleRepository).toContain('onConflict: "execution_id"');
    expect(repository).toContain('order("decision_timestamp", { ascending: true })');
    expect(repository).toContain('order("snapshot_id", { ascending: true })');
  });
});

