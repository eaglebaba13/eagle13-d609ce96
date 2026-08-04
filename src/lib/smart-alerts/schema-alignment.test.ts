import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260718082856_450809cc-b656-4c5a-84fc-e6f109058198.sql", "utf8");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");

describe("smart-alerts Supabase schema alignment", () => {
  it("defines expected alert tables and idempotency constraints", () => {
    for (const table of ["smart_alert_events", "smart_alert_subscriptions", "smart_alert_delivery_attempts", "smart_alert_engine_checkpoints"]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
      expect(types).toContain(`${table}: {`);
    }
    expect(migration).toContain("CONSTRAINT smart_alert_events_fingerprint_unique UNIQUE (user_id, fingerprint)");
    expect(migration).toContain("idx_smart_alert_events_user_unread");
  });

  it("enables RLS and does not grant public alert writes", () => {
    expect(migration).toContain("ALTER TABLE public.smart_alert_events ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.smart_alert_delivery_attempts ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL).*smart_alert_.*\s+TO\s+(PUBLIC|anon)/i);
  });

  it("does not define raw secret transport columns", () => {
    expect(migration).not.toMatch(/authorization|cookie|access_token|refresh_token|api_key|webhook_url|bot_token|chat_id/i);
  });
});
