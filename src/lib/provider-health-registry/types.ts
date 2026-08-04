// Phase 53 — Institutional Provider Health Registry (public types).
// Additive layer over existing `provider-foundation`. No formula changes,
// no broker paths. SSR-safe.

export type ProviderHealthCode =
  | "HEALTHY"
  | "DEGRADED"
  | "STALE"
  | "RATE_LIMITED"
  | "AUTH_REQUIRED"
  | "UNAVAILABLE";

export type MarketStatus = "OPEN" | "PRE_OPEN" | "CLOSED" | "UNKNOWN";

export interface ProviderHealthSample {
  readonly at: string;              // ISO timestamp
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly ageSeconds: number;      // freshness at record time
  readonly reason?: ProviderHealthCode;
}

export interface ProviderHealthSnapshot {
  readonly providerId: string;
  readonly label: string;
  readonly code: ProviderHealthCode;
  readonly marketStatus: MarketStatus;
  readonly lastUpdateAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly ageSeconds: number;
  readonly latencyMs: number;
  readonly successRate: number;     // 0..1
  readonly failureCount: number;
  readonly qualityScore: number;    // 0..100
  readonly totalSamples: number;
  readonly freshness: "FRESH" | "AGING" | "STALE" | "UNKNOWN";
}