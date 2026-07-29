// Phase 53 — Provider-neutral failover helper.
// Sequence: primary -> secondary -> cached snapshot -> UNAVAILABLE.
// Never fabricates values; returned state is explicit.

import { recordProviderSample } from "./registry";
import type { ProviderHealthCode } from "./types";

export type FailoverSource = "PRIMARY" | "SECONDARY" | "CACHE" | "UNAVAILABLE";

export interface FailoverResult<T> {
  readonly ok: boolean;
  readonly source: FailoverSource;
  readonly data: T | null;
  readonly latencyMs: number;
  readonly ageSeconds: number;
  readonly reason?: ProviderHealthCode;
  readonly errors: readonly string[];
}

export interface FailoverTier<T> {
  readonly providerId: string;
  readonly label?: string;
  readonly fetch: () => Promise<{ data: T; ageSeconds?: number }>;
}

export interface CacheTier<T> {
  readonly get: () => { data: T; ageSeconds: number } | null;
  readonly maxAgeSeconds?: number;
}

export async function runWithFailover<T>(
  primary: FailoverTier<T>,
  secondary: FailoverTier<T> | null,
  cache: CacheTier<T> | null = null,
): Promise<FailoverResult<T>> {
  const errors: string[] = [];
  for (const [tier, role] of [
    [primary, "PRIMARY"],
    ...(secondary ? [[secondary, "SECONDARY"] as const] : []),
  ] as ReadonlyArray<readonly [FailoverTier<T>, FailoverSource]>) {
    const started = Date.now();
    try {
      const out = await tier.fetch();
      const latencyMs = Date.now() - started;
      const ageSeconds = Math.max(0, Math.floor(out.ageSeconds ?? 0));
      recordProviderSample({
        providerId: tier.providerId,
        label: tier.label,
        ok: true,
        latencyMs,
        ageSeconds,
      });
      return { ok: true, source: role, data: out.data, latencyMs, ageSeconds, errors };
    } catch (err) {
      const latencyMs = Date.now() - started;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${tier.providerId}: ${msg}`);
      recordProviderSample({
        providerId: tier.providerId,
        label: tier.label,
        ok: false,
        latencyMs,
        ageSeconds: 0,
        reason: "DEGRADED",
      });
    }
  }
  if (cache) {
    const snap = cache.get();
    const maxAge = cache.maxAgeSeconds ?? 900;
    if (snap && snap.ageSeconds <= maxAge) {
      return { ok: true, source: "CACHE", data: snap.data, latencyMs: 0, ageSeconds: snap.ageSeconds, errors };
    }
  }
  return { ok: false, source: "UNAVAILABLE", data: null, latencyMs: 0, ageSeconds: 0, reason: "UNAVAILABLE", errors };
}