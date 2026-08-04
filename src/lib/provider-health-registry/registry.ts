// Phase 53 — In-memory provider health registry. SSR-safe (module scope
// state is per-worker; no side-effects at import time beyond the empty
// Map). Never fabricates data — everything is recorded by call sites.

import type {
  MarketStatus,
  ProviderHealthCode,
  ProviderHealthSample,
  ProviderHealthSnapshot,
} from "./types";

interface Entry {
  readonly providerId: string;
  label: string;
  marketStatus: MarketStatus;
  samples: ProviderHealthSample[];
}

const MAX_SAMPLES = 100;
const REGISTRY = new Map<string, Entry>();

export interface RegisterProviderInput {
  readonly providerId: string;
  readonly label?: string;
  readonly marketStatus?: MarketStatus;
}

export function registerProvider(input: RegisterProviderInput): void {
  const cur = REGISTRY.get(input.providerId);
  if (!cur) {
    REGISTRY.set(input.providerId, {
      providerId: input.providerId,
      label: input.label ?? input.providerId,
      marketStatus: input.marketStatus ?? "UNKNOWN",
      samples: [],
    });
    return;
  }
  if (input.label) cur.label = input.label;
  if (input.marketStatus) cur.marketStatus = input.marketStatus;
}

export interface RecordSampleInput {
  readonly providerId: string;
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly ageSeconds: number;
  readonly reason?: ProviderHealthCode;
  readonly at?: string;
  readonly label?: string;
  readonly marketStatus?: MarketStatus;
}

export function recordProviderSample(input: RecordSampleInput): void {
  registerProvider({
    providerId: input.providerId,
    label: input.label,
    marketStatus: input.marketStatus,
  });
  const e = REGISTRY.get(input.providerId)!;
  e.samples.push({
    at: input.at ?? new Date().toISOString(),
    ok: input.ok,
    latencyMs: Math.max(0, input.latencyMs),
    ageSeconds: Math.max(0, input.ageSeconds),
    reason: input.reason,
  });
  if (e.samples.length > MAX_SAMPLES) {
    e.samples.splice(0, e.samples.length - MAX_SAMPLES);
  }
}

function classify(
  successRate: number,
  ageSeconds: number,
  lastReason: ProviderHealthCode | undefined,
): ProviderHealthCode {
  if (lastReason === "AUTH_REQUIRED") return "AUTH_REQUIRED";
  if (lastReason === "RATE_LIMITED") return "RATE_LIMITED";
  if (successRate <= 0) return "UNAVAILABLE";
  if (ageSeconds > 900) return "STALE";
  if (successRate < 0.5) return "DEGRADED";
  if (ageSeconds > 60) return "DEGRADED";
  return "HEALTHY";
}

function freshnessOf(ageSeconds: number, hasSamples: boolean): ProviderHealthSnapshot["freshness"] {
  if (!hasSamples) return "UNKNOWN";
  if (ageSeconds <= 60) return "FRESH";
  if (ageSeconds <= 900) return "AGING";
  return "STALE";
}

export function qualityScore(successRate: number, ageSeconds: number, latencyMs: number): number {
  const succ = Math.max(0, Math.min(1, successRate)) * 60;
  const fresh = ageSeconds <= 60 ? 25 : ageSeconds <= 300 ? 15 : ageSeconds <= 900 ? 5 : 0;
  const lat = latencyMs <= 300 ? 15 : latencyMs <= 1000 ? 10 : latencyMs <= 3000 ? 5 : 0;
  return Math.round(succ + fresh + lat);
}

export function getProviderHealth(providerId: string): ProviderHealthSnapshot | null {
  const e = REGISTRY.get(providerId);
  if (!e) return null;
  return buildSnapshot(e);
}

export function listProviderHealth(): ProviderHealthSnapshot[] {
  return [...REGISTRY.values()].map(buildSnapshot).sort((a, b) => a.providerId.localeCompare(b.providerId));
}

function buildSnapshot(e: Entry): ProviderHealthSnapshot {
  const n = e.samples.length;
  const last = n ? e.samples[n - 1]! : null;
  const successes = e.samples.filter((s) => s.ok);
  const failures = e.samples.filter((s) => !s.ok);
  const successRate = n ? successes.length / n : 0;
  const lastSuccess = [...successes].pop() ?? null;
  const lastFailure = [...failures].pop() ?? null;
  const avgLatency = n ? e.samples.reduce((a, s) => a + s.latencyMs, 0) / n : 0;
  const ageSeconds = lastSuccess ? Math.max(0, Math.floor((Date.now() - Date.parse(lastSuccess.at)) / 1000)) : Number.POSITIVE_INFINITY;
  const safeAge = Number.isFinite(ageSeconds) ? ageSeconds : 99_999;
  const code = n === 0 ? "UNAVAILABLE" : classify(successRate, safeAge, last?.reason);
  return {
    providerId: e.providerId,
    label: e.label,
    code,
    marketStatus: e.marketStatus,
    lastUpdateAt: last?.at ?? null,
    lastSuccessAt: lastSuccess?.at ?? null,
    lastFailureAt: lastFailure?.at ?? null,
    ageSeconds: safeAge,
    latencyMs: Math.round(avgLatency),
    successRate: Math.round(successRate * 1000) / 1000,
    failureCount: failures.length,
    qualityScore: n === 0 ? 0 : qualityScore(successRate, safeAge, avgLatency),
    totalSamples: n,
    freshness: freshnessOf(safeAge, n > 0),
  };
}

/** Test-only reset. */
export function _resetProviderHealthRegistry(): void {
  REGISTRY.clear();
}