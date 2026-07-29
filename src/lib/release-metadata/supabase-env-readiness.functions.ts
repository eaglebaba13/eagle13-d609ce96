// Public server function reporting Supabase environment readiness.
// Returns presence-only booleans + where each variable is used. Never
// returns values, secret prefixes, project refs, or any PII.

import { createServerFn } from "@tanstack/react-start";

export type EnvScope = "browser" | "server";
export type EnvClass = "publishable" | "service-role" | "url" | "config";

export interface SupabaseEnvEntry {
  readonly name: string;
  readonly scope: EnvScope;
  readonly class: EnvClass;
  readonly present: boolean;
  readonly required: boolean;
  readonly usedFor: string;
}

export interface SupabaseEnvReadiness {
  readonly channel: string;
  readonly checkedAt: string;
  readonly allRequiredPresent: boolean;
  readonly entries: readonly SupabaseEnvEntry[];
}

export const getSupabaseEnvReadiness = createServerFn({ method: "GET" }).handler(
  async (): Promise<SupabaseEnvReadiness> => {
    const has = (name: string): boolean => {
      const v = process.env[name];
      return typeof v === "string" && v.length > 0;
    };

    // Browser-visible values are injected at build time. Report by checking
    // the server-side twin — the Lovable Cloud integration keeps them in sync.
    const entries: SupabaseEnvEntry[] = [
      {
        name: "VITE_SUPABASE_URL",
        scope: "browser",
        class: "url",
        present: has("SUPABASE_URL"),
        required: true,
        usedFor: "Browser Supabase client (@/integrations/supabase/client)",
      },
      {
        name: "VITE_SUPABASE_PUBLISHABLE_KEY",
        scope: "browser",
        class: "publishable",
        present: has("SUPABASE_PUBLISHABLE_KEY"),
        required: true,
        usedFor: "Browser Supabase client — publishable anon key",
      },
      {
        name: "SUPABASE_URL",
        scope: "server",
        class: "url",
        present: has("SUPABASE_URL"),
        required: true,
        usedFor: "Server functions, auth middleware, morning-brief webhook",
      },
      {
        name: "SUPABASE_PUBLISHABLE_KEY",
        scope: "server",
        class: "publishable",
        present: has("SUPABASE_PUBLISHABLE_KEY"),
        required: true,
        usedFor: "requireSupabaseAuth middleware, public read-only server calls",
      },
      {
        name: "SUPABASE_SERVICE_ROLE_KEY",
        scope: "server",
        class: "service-role",
        present: has("SUPABASE_SERVICE_ROLE_KEY"),
        required: true,
        usedFor: "Privileged admin client (client.server) — never sent to browser",
      },
      {
        name: "SUPABASE_DB_URL",
        scope: "server",
        class: "config",
        present: has("SUPABASE_DB_URL"),
        required: false,
        usedFor: "Reserved for direct DB tooling; not read at runtime",
      },
    ];

    const allRequiredPresent = entries.every((e) => !e.required || e.present);
    const channel = process.env.VITE_RELEASE_CHANNEL || process.env.RELEASE_CHANNEL || "CLOSED_BETA";

    return {
      channel,
      checkedAt: new Date().toISOString(),
      allRequiredPresent,
      entries,
    };
  },
);