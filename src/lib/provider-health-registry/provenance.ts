// Phase 53B — Optional additive provenance metadata for live-data payloads.
//
// Attached to responses under the reserved `__provenance` field so existing
// typed contracts remain untouched. Never used to fabricate business data.

import type { ProviderHealthCode, ProviderHealthSnapshot } from "./types";

export type FreshnessState = "FRESH" | "AGING" | "STALE" | "UNKNOWN";
export type FailoverState = "PRIMARY" | "SECONDARY" | "CACHE" | "UNAVAILABLE";

export interface ProviderProvenance {
  readonly providerId: string;
  readonly label: string;
  readonly status: ProviderHealthCode;
  readonly fetchedAt: string;
  readonly sourceTimestamp: string | null;
  readonly ageSeconds: number;
  readonly freshness: FreshnessState;
  readonly latencyMs: number;
  readonly qualityScore: number;
  readonly qualityCodes: readonly string[];
  readonly failoverState: FailoverState;
  readonly cached: boolean;
  readonly lastSuccessAt: string | null;
  readonly mock?: boolean;
}

export interface ProvenanceCarrier {
  readonly __provenance?: ProviderProvenance;
}

export function attachProvenance<T extends object>(
  payload: T,
  provenance: ProviderProvenance,
): T & ProvenanceCarrier {
  return { ...payload, __provenance: provenance };
}

export function readProvenance(payload: unknown): ProviderProvenance | null {
  if (!payload || typeof payload !== "object") return null;
  const p = (payload as ProvenanceCarrier).__provenance;
  return p ?? null;
}

export function provenanceFromSnapshot(
  snap: ProviderHealthSnapshot,
  extras: {
    fetchedAt: string;
    sourceTimestamp?: string | null;
    qualityCodes?: readonly string[];
    failoverState?: FailoverState;
    cached?: boolean;
    mock?: boolean;
  },
): ProviderProvenance {
  return {
    providerId: snap.providerId,
    label: snap.label,
    status: snap.code,
    fetchedAt: extras.fetchedAt,
    sourceTimestamp: extras.sourceTimestamp ?? null,
    ageSeconds: snap.ageSeconds,
    freshness: snap.freshness,
    latencyMs: snap.latencyMs,
    qualityScore: snap.qualityScore,
    qualityCodes: extras.qualityCodes ?? [],
    failoverState: extras.failoverState ?? "PRIMARY",
    cached: extras.cached ?? false,
    lastSuccessAt: snap.lastSuccessAt,
    mock: extras.mock,
  };
}