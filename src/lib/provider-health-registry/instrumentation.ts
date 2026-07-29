// Phase 53B — Non-breaking wrapper that records provider samples around
// existing fetchers. Preserves the underlying payload shape byte-for-byte;
// callers opt in to provenance via `attachProvenance`.

import { getProviderHealth, recordProviderSample, registerProvider } from "./registry";
import type { ProviderHealthCode } from "./types";
import {
  attachProvenance,
  provenanceFromSnapshot,
  type FailoverState,
  type ProviderProvenance,
} from "./provenance";

export interface InstrumentOptions<T> {
  readonly providerId: string;
  readonly label?: string;
  readonly fetch: () => Promise<T>;
  readonly extractAgeSeconds?: (payload: T) => number;
  readonly extractSourceTimestamp?: (payload: T) => string | null;
  readonly classifyError?: (err: unknown) => ProviderHealthCode;
  readonly failoverState?: FailoverState;
  readonly cached?: boolean;
  readonly mock?: boolean;
  readonly qualityCodes?: readonly string[];
}

export interface InstrumentedResult<T> {
  readonly ok: boolean;
  readonly data: T | null;
  readonly error: string | null;
  readonly provenance: ProviderProvenance;
}

function defaultClassify(err: unknown): ProviderHealthCode {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("401") || msg.includes("auth")) return "AUTH_REQUIRED";
  if (msg.includes("429") || msg.includes("rate")) return "RATE_LIMITED";
  if (msg.includes("timeout") || msg.includes("network")) return "DEGRADED";
  return "DEGRADED";
}

export async function instrumentProviderCall<T>(
  opts: InstrumentOptions<T>,
): Promise<InstrumentedResult<T>> {
  registerProvider({ providerId: opts.providerId, label: opts.label });
  const started = Date.now();
  const fetchedAt = new Date(started).toISOString();
  try {
    const data = await opts.fetch();
    const latencyMs = Date.now() - started;
    const ageSeconds = Math.max(0, Math.floor(opts.extractAgeSeconds?.(data) ?? 0));
    const sourceTimestamp = opts.extractSourceTimestamp?.(data) ?? null;
    recordProviderSample({
      providerId: opts.providerId,
      label: opts.label,
      ok: true,
      latencyMs,
      ageSeconds,
    });
    const snap = getProviderHealth(opts.providerId)!;
    return {
      ok: true,
      data,
      error: null,
      provenance: provenanceFromSnapshot(snap, {
        fetchedAt,
        sourceTimestamp,
        qualityCodes: opts.qualityCodes,
        failoverState: opts.failoverState ?? "PRIMARY",
        cached: opts.cached ?? false,
        mock: opts.mock,
      }),
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const reason = (opts.classifyError ?? defaultClassify)(err);
    recordProviderSample({
      providerId: opts.providerId,
      label: opts.label,
      ok: false,
      latencyMs,
      ageSeconds: 0,
      reason,
    });
    const snap = getProviderHealth(opts.providerId)!;
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      provenance: provenanceFromSnapshot(snap, {
        fetchedAt,
        failoverState: opts.failoverState ?? "PRIMARY",
        cached: false,
        mock: opts.mock,
        qualityCodes: [reason],
      }),
    };
  }
}

/** Convenience: attach provenance to a payload if it is a plain object. */
export function withProvenance<T>(result: InstrumentedResult<T>): T | null {
  if (!result.ok || result.data == null) return null;
  if (typeof result.data !== "object") return result.data;
  return attachProvenance(result.data as unknown as object, result.provenance) as unknown as T;
}