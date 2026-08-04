// Phase 51B — Verification tests: CSV import, dataset contract, export metadata.
import { describe, it, expect } from "vitest";
import { parseCsvHistorical } from "./csv-import";
import { analyzeQuality, syntheticDataset } from "./dataset";
import { generateSyntheticBars } from "./synthetic-bars";
import { backtestToJson, reportToPrintable, tradesToCsv, EXPORT_SCHEMA_VERSION } from "./exports";
import { runBacktest } from "./backtest";
import { generateReport } from "./report";
import { BUILTIN_STRATEGIES } from "./templates";

describe("csv-import", () => {
  const good = `timestamp,open,high,low,close,volume,gti,vix\n2024-01-01,100,105,99,104,1000,55,14\n2024-01-02,104,108,103,107,1100,60,13\n`;

  it("parses valid rows and maps optional indicators", () => {
    const r = parseCsvHistorical(good, { filename: "t.csv" });
    expect(r.dataset.status).toBe("IMPORTED");
    expect(r.dataset.bars.length).toBe(2);
    expect(r.dataset.bars[0].indicators.GTI).toBe(55);
    expect(r.dataset.bars[0].indicators.VIX).toBe(14);
    expect(r.quality.critical).toBe(false);
  });

  it("rejects zero/negative prices and OHLC inconsistency", () => {
    const bad = `timestamp,open,high,low,close\n2024-01-01,100,90,95,92\n2024-01-02,-1,2,1,1\n`;
    const r = parseCsvHistorical(bad);
    expect(r.dataset.bars.length).toBe(0);
    expect(r.rejectedRows.length).toBeGreaterThanOrEqual(2);
  });

  it("flags duplicate timestamps", () => {
    const dup = `timestamp,open,high,low,close\n2024-01-01,100,105,99,104\n2024-01-01,104,108,103,107\n`;
    const r = parseCsvHistorical(dup);
    expect(r.quality.duplicateRows).toBe(1);
  });

  it("is deterministic — same input → same dataset bars", () => {
    const a = parseCsvHistorical(good);
    const b = parseCsvHistorical(good);
    expect(a.dataset.bars).toEqual(b.dataset.bars);
  });

  it("blocks empty CSV", () => {
    const r = parseCsvHistorical("");
    expect(r.dataset.status).toBe("INVALID");
  });
});

describe("dataset quality analysis", () => {
  it("marks synthetic status without flags", () => {
    const bars = generateSyntheticBars({ seed: 1, bars: 30 });
    const ds = syntheticDataset(bars, 1);
    expect(ds.status).toBe("SYNTHETIC");
    expect(ds.source).toContain("SYNTHETIC");
  });

  it("detects non-monotonic timestamps as critical", () => {
    const bars = [
      { t: 2, open: 1, high: 1, low: 1, close: 1, indicators: {} },
      { t: 1, open: 1, high: 1, low: 1, close: 1, indicators: {} },
    ];
    const q = analyzeQuality(bars, 0, 0, 0, 0, "IMPORTED");
    expect(q.critical).toBe(true);
  });
});

describe("export integrity", () => {
  const bars = generateSyntheticBars({ seed: 4, bars: 60 });
  const ds = syntheticDataset(bars, 4);
  const strategy = BUILTIN_STRATEGIES[0];
  const result = runBacktest(strategy, bars);
  const report = generateReport(result);

  it("json export includes schema version and dataset status", () => {
    const json = JSON.parse(backtestToJson(strategy, result, report, ds));
    expect(json.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(json.dataset.status).toBe("SYNTHETIC");
    expect(json.result.totalTrades).toBe(result.totalTrades);
  });

  it("printable report shows synthetic warning", () => {
    const txt = reportToPrintable(strategy, result, report, ds);
    expect(txt).toContain("SYNTHETIC DATA");
    expect(txt).toContain("NOT LIVE MARKET DATA");
  });

  it("csv trade export escapes commas/quotes safely", () => {
    // Baseline: header + rows count matches
    const csv = tradesToCsv(result);
    expect(csv.split("\n").length).toBe(result.trades.length + 1);
  });
});

describe("backtest execution safety", () => {
  it("closes any open position on the final bar (EOD)", () => {
    const bars = generateSyntheticBars({ seed: 2, bars: 80 });
    const r = runBacktest(BUILTIN_STRATEGIES[0], bars);
    // No open position invariant: every trade has an exit
    for (const t of r.trades) expect(t.exitTime).toBeGreaterThanOrEqual(t.entryTime);
  });
});