// Phase 53 — Deterministic Data Quality Engine.
// Validates a market-data record against institutional rules and returns
// stable quality codes. Never fabricates; only classifies.

export type DataQualityCode =
  | "OK"
  | "STALE_TIMESTAMP"
  | "FUTURE_TIMESTAMP"
  | "DUPLICATE_RECORD"
  | "MISSING_STRIKE"
  | "INVALID_PRICE"
  | "NEGATIVE_VALUE"
  | "ZERO_VOLUME"
  | "ZERO_OI"
  | "INCONSISTENT_EXPIRY"
  | "MISSING_GREEKS";

export interface QualityInput {
  readonly timestamp?: string | number | null;
  readonly nowMs?: number;
  readonly maxAgeSeconds?: number;
  readonly strike?: number | null;
  readonly lastPrice?: number | null;
  readonly volume?: number | null;
  readonly openInterest?: number | null;
  readonly expiry?: string | null;
  readonly expectedExpiry?: string | null;
  readonly greeks?: {
    readonly delta?: number | null;
    readonly gamma?: number | null;
    readonly theta?: number | null;
    readonly vega?: number | null;
  } | null;
  readonly recordId?: string | null;
  readonly seenIds?: ReadonlySet<string>;
  readonly requireGreeks?: boolean;
  readonly requireVolume?: boolean;
  readonly requireOpenInterest?: boolean;
}

export interface QualityReport {
  readonly codes: readonly DataQualityCode[];
  readonly ok: boolean;
  readonly score: number; // 0..100
}

function toMs(ts: string | number | null | undefined): number | null {
  if (ts == null) return null;
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : null;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

export function validateRecord(input: QualityInput): QualityReport {
  const codes: DataQualityCode[] = [];
  const now = input.nowMs ?? Date.now();
  const maxAge = (input.maxAgeSeconds ?? 900) * 1000;

  const tsMs = toMs(input.timestamp);
  if (tsMs != null) {
    if (tsMs - now > 60_000) codes.push("FUTURE_TIMESTAMP");
    else if (now - tsMs > maxAge) codes.push("STALE_TIMESTAMP");
  }

  if (input.recordId && input.seenIds && input.seenIds.has(input.recordId)) {
    codes.push("DUPLICATE_RECORD");
  }

  if (input.strike != null && (!Number.isFinite(input.strike) || input.strike <= 0)) {
    codes.push("MISSING_STRIKE");
  }

  if (input.lastPrice != null) {
    if (!Number.isFinite(input.lastPrice) || input.lastPrice <= 0) codes.push("INVALID_PRICE");
  }

  const negatives: Array<number | null | undefined> = [input.lastPrice, input.volume, input.openInterest];
  if (negatives.some((v) => typeof v === "number" && v < 0)) codes.push("NEGATIVE_VALUE");

  if (input.requireVolume && (input.volume == null || input.volume === 0)) codes.push("ZERO_VOLUME");
  if (input.requireOpenInterest && (input.openInterest == null || input.openInterest === 0)) codes.push("ZERO_OI");

  if (input.expectedExpiry && input.expiry && input.expiry !== input.expectedExpiry) {
    codes.push("INCONSISTENT_EXPIRY");
  }

  if (input.requireGreeks) {
    const g = input.greeks;
    if (!g || g.delta == null || g.gamma == null || g.theta == null || g.vega == null) {
      codes.push("MISSING_GREEKS");
    }
  }

  const penalty = codes.length * 15;
  const score = Math.max(0, 100 - penalty);
  return { codes, ok: codes.length === 0, score };
}