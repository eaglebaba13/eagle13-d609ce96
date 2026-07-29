// Phase 51B — Local CSV historical-data importer. Pure & deterministic.
// Runs entirely in-browser; never uploads data to a server.
import type { Bar, IndicatorSnapshot, IndicatorId } from "./types";
import { analyzeQuality, type DataQualityReport, type HistoricalDataset } from "./dataset";

export type CsvColumnMapping = {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
  indicators?: Partial<Record<IndicatorId, string>>;
};

export type CsvParseOptions = {
  timezone?: string; // IANA (informational only)
  filename?: string;
  mapping?: Partial<CsvColumnMapping>;
};

export type CsvParseResult = {
  readonly dataset: HistoricalDataset;
  readonly quality: DataQualityReport;
  readonly headers: readonly string[];
  readonly rejectedRows: ReadonlyArray<{ readonly row: number; readonly reason: string }>;
};

const DEFAULT_MAP: CsvColumnMapping = {
  timestamp: "timestamp",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  volume: "volume",
};

const INDICATOR_COLS: Record<string, IndicatorId> = {
  gti: "GTI",
  astro_bias: "ASTRO_BIAS",
  gann_bias: "GANN_BIAS",
  vix: "VIX",
  pcr: "PCR",
  institutional_score: "INSTITUTIONAL_SCORE",
  breadth: "MARKET_BREADTH",
  sector_rotation: "SECTOR_ROTATION",
  ai_decision: "AI_DECISION",
  gold_silver_ratio: "GOLD_SILVER_RATIO",
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === ",") { out.push(cur); cur = ""; }
      else if (c === '"') { inQ = true; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseTs(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n < 1e12 ? n * 1000 : n;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export function parseCsvHistorical(text: string, opts: CsvParseOptions = {}): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    const dataset: HistoricalDataset = {
      instrument: "UNKNOWN", exchange: "UNKNOWN", timeframe: "unknown",
      startTime: 0, endTime: 0, bars: [], source: `CSV(${opts.filename ?? "?"})`,
      timezone: opts.timezone ?? "UTC", adjusted: false, status: "INVALID",
      qualityFlags: ["MISSING_FIELDS"], generatedAt: Date.now(), filename: opts.filename,
    };
    return {
      dataset,
      quality: analyzeQuality([], 0, 0, 0, 0, "INVALID"),
      headers: [],
      rejectedRows: [{ row: 0, reason: "CSV is empty or has no data rows" }],
    };
  }
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const map = { ...DEFAULT_MAP, ...(opts.mapping ?? {}) };
  const col = (name: string) => headers.indexOf(name.toLowerCase());
  const iTs = col(map.timestamp), iO = col(map.open), iH = col(map.high), iL = col(map.low), iC = col(map.close);
  const iV = map.volume ? col(map.volume) : -1;

  const indicatorIdx: Array<{ id: IndicatorId; idx: number }> = [];
  for (const [h, id] of Object.entries(INDICATOR_COLS)) {
    const idx = headers.indexOf(h);
    if (idx >= 0) indicatorIdx.push({ id, idx });
  }
  if (opts.mapping?.indicators) {
    for (const [id, colName] of Object.entries(opts.mapping.indicators)) {
      if (!colName) continue;
      const idx = headers.indexOf(colName.toLowerCase());
      if (idx >= 0) indicatorIdx.push({ id: id as IndicatorId, idx });
    }
  }

  const bars: Bar[] = [];
  const rejected: { row: number; reason: string }[] = [];
  const seenTs = new Set<number>();
  let missingTimestamps = 0, missingOHLCV = 0, duplicateRows = 0;

  if (iTs < 0 || iO < 0 || iH < 0 || iL < 0 || iC < 0) {
    rejected.push({ row: 0, reason: "Missing required column(s): timestamp/open/high/low/close" });
  } else {
    for (let r = 1; r < lines.length; r++) {
      const cells = splitCsvLine(lines[r]);
      const ts = parseTs(cells[iTs] ?? "");
      if (ts == null) { missingTimestamps++; rejected.push({ row: r, reason: "Invalid timestamp" }); continue; }
      const o = Number(cells[iO]), h = Number(cells[iH]), l = Number(cells[iL]), c = Number(cells[iC]);
      if (![o, h, l, c].every(Number.isFinite)) { missingOHLCV++; rejected.push({ row: r, reason: "Missing/invalid OHLC" }); continue; }
      if (o <= 0 || h <= 0 || l <= 0 || c <= 0) { rejected.push({ row: r, reason: "Zero/negative price" }); continue; }
      if (!(h >= Math.max(o, c) && l <= Math.min(o, c))) { rejected.push({ row: r, reason: "OHLC inconsistency" }); continue; }
      if (seenTs.has(ts)) { duplicateRows++; rejected.push({ row: r, reason: "Duplicate timestamp" }); continue; }
      seenTs.add(ts);
      const indicators: IndicatorSnapshot = {};
      for (const { id, idx } of indicatorIdx) {
        const v = Number(cells[idx]);
        if (Number.isFinite(v)) (indicators as Record<string, number>)[id] = v;
      }
      if (iV >= 0) { /* volume parsed but not stored on Bar */ void Number(cells[iV]); }
      bars.push({ t: ts, open: o, high: h, low: l, close: c, indicators });
    }
    bars.sort((a, b) => a.t - b.t);
  }

  const filename = opts.filename ?? "upload.csv";
  const status = bars.length > 0 ? "IMPORTED" : "INVALID";
  const quality = analyzeQuality(bars, rejected.length - duplicateRows - missingTimestamps - missingOHLCV, duplicateRows, missingTimestamps, missingOHLCV, status);
  const dataset: HistoricalDataset = {
    instrument: "IMPORTED",
    exchange: "IMPORTED",
    timeframe: quality.timeframeEstimate,
    startTime: bars[0]?.t ?? 0,
    endTime: bars[bars.length - 1]?.t ?? 0,
    bars,
    source: `CSV(${filename})`,
    timezone: opts.timezone ?? "UTC",
    adjusted: false,
    status: quality.critical ? "INVALID" : status,
    qualityFlags: [],
    generatedAt: Date.now(),
    filename,
  };
  return { dataset, quality, headers, rejectedRows: rejected };
}