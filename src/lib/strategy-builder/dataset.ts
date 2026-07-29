// Phase 51B — Provider-neutral historical dataset contract.
// No network I/O. No paid/unofficial providers connected here.
import type { Bar } from "./types";

export type DatasetStatus =
  | "SYNTHETIC"
  | "IMPORTED"
  | "VERIFIED_PROVIDER"
  | "PROVIDER_PENDING"
  | "INVALID";

export type DatasetQualityFlag =
  | "OHLC_INCONSISTENT"
  | "NON_MONOTONIC_TIME"
  | "DUPLICATE_TIMESTAMP"
  | "ZERO_OR_NEGATIVE_PRICE"
  | "MISSING_FIELDS"
  | "SPARSE_INDICATORS";

export type HistoricalDataset = {
  readonly instrument: string;
  readonly exchange: string;
  readonly timeframe: string; // e.g. "1d", "5m"
  readonly startTime: number;
  readonly endTime: number;
  readonly bars: readonly Bar[];
  readonly source: string; // "SYNTHETIC(seed=…)" | "CSV(filename)" | provider id
  readonly timezone: string; // IANA
  readonly adjusted: boolean;
  readonly status: DatasetStatus;
  readonly qualityFlags: readonly DatasetQualityFlag[];
  readonly generatedAt: number;
  readonly seed?: number;
  readonly filename?: string;
};

export type DataQualityReport = {
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly duplicateRows: number;
  readonly missingTimestamps: number;
  readonly missingOHLCV: number;
  readonly indicatorCoverage: Record<string, number>; // 0..1
  readonly startTime: number | null;
  readonly endTime: number | null;
  readonly timeframeEstimate: string;
  readonly status: DatasetStatus;
  readonly critical: boolean; // if true, block backtest
  readonly issues: readonly string[];
};

export function estimateTimeframe(bars: readonly Bar[]): string {
  if (bars.length < 2) return "unknown";
  const diffs: number[] = [];
  for (let i = 1; i < bars.length; i++) diffs.push(bars[i].t - bars[i - 1].t);
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  const min = 60_000;
  if (median >= 86_400_000) return `${Math.round(median / 86_400_000)}d`;
  if (median >= 3_600_000) return `${Math.round(median / 3_600_000)}h`;
  if (median >= min) return `${Math.round(median / min)}m`;
  return `${median}ms`;
}

export function analyzeQuality(
  bars: readonly Bar[],
  invalidRows: number,
  duplicateRows: number,
  missingTimestamps: number,
  missingOHLCV: number,
  status: DatasetStatus,
): DataQualityReport {
  const total = bars.length + invalidRows;
  const issues: string[] = [];
  let critical = false;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].t <= bars[i - 1].t) { issues.push(`Non-monotonic timestamp at row ${i}`); critical = true; break; }
  }
  for (const b of bars) {
    if (!(b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close))) {
      issues.push("OHLC inconsistency detected"); critical = true; break;
    }
    if (b.open <= 0 || b.close <= 0 || b.high <= 0 || b.low <= 0) {
      issues.push("Zero or negative price detected"); critical = true; break;
    }
  }
  if (missingOHLCV > 0) issues.push(`${missingOHLCV} rows missing OHLCV fields`);
  if (duplicateRows > 0) issues.push(`${duplicateRows} duplicate timestamps`);
  if (missingTimestamps > 0) { issues.push(`${missingTimestamps} rows missing timestamp`); critical = true; }

  const indicatorKeys = new Set<string>();
  for (const b of bars) for (const k of Object.keys(b.indicators)) indicatorKeys.add(k);
  const coverage: Record<string, number> = {};
  for (const k of indicatorKeys) {
    let n = 0;
    for (const b of bars) if ((b.indicators as Record<string, number | undefined>)[k] != null) n++;
    coverage[k] = bars.length > 0 ? n / bars.length : 0;
  }

  return {
    totalRows: total,
    validRows: bars.length,
    invalidRows,
    duplicateRows,
    missingTimestamps,
    missingOHLCV,
    indicatorCoverage: coverage,
    startTime: bars[0]?.t ?? null,
    endTime: bars[bars.length - 1]?.t ?? null,
    timeframeEstimate: estimateTimeframe(bars),
    status: critical ? "INVALID" : status,
    critical,
    issues,
  };
}

export function syntheticDataset(bars: readonly Bar[], seed: number): HistoricalDataset {
  return {
    instrument: "SYNTHETIC-INDEX",
    exchange: "SYNTHETIC",
    timeframe: estimateTimeframe(bars),
    startTime: bars[0]?.t ?? 0,
    endTime: bars[bars.length - 1]?.t ?? 0,
    bars,
    source: `SYNTHETIC(seed=${seed})`,
    timezone: "UTC",
    adjusted: false,
    status: "SYNTHETIC",
    qualityFlags: [],
    generatedAt: Date.now(),
    seed,
  };
}