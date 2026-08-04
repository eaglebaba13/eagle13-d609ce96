// Phase 51 — Export helpers (CSV / JSON / plain-text PDF payload).
import type { BacktestResult, Strategy, StrategyReport } from "./types";
import type { HistoricalDataset } from "./dataset";

export const EXPORT_SCHEMA_VERSION = "51B.1";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function tradesToCsv(r: BacktestResult): string {
  const header = "entryTime,exitTime,side,entryPrice,exitPrice,pnl,pnlPct,holdBars,exitReason";
  const rows = r.trades.map((t) =>
    [csvEscape(new Date(t.entryTime).toISOString()), csvEscape(new Date(t.exitTime).toISOString()),
     csvEscape(t.side), csvEscape(t.entryPrice.toFixed(2)), csvEscape(t.exitPrice.toFixed(2)),
     csvEscape(t.pnl.toFixed(2)), csvEscape(t.pnlPct.toFixed(2)), csvEscape(t.holdBars), csvEscape(t.exitReason)].join(","),
  );
  return [header, ...rows].join("\n");
}

export function backtestToJson(strategy: Strategy, r: BacktestResult, report: StrategyReport, dataset?: HistoricalDataset): string {
  return JSON.stringify({
    schema: "eaglebaba.backtest",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    dataset: dataset
      ? { status: dataset.status, source: dataset.source, timeframe: dataset.timeframe,
          instrument: dataset.instrument, filename: dataset.filename, seed: dataset.seed,
          startTime: dataset.startTime, endTime: dataset.endTime, timezone: dataset.timezone }
      : null,
    strategy, result: r, report,
  }, null, 2);
}

export function reportToPrintable(strategy: Strategy, r: BacktestResult, report: StrategyReport, dataset?: HistoricalDataset): string {
  const lines: string[] = [];
  lines.push(`STRATEGY REPORT — ${strategy.name}`);
  lines.push("=".repeat(60));
  if (dataset) {
    if (dataset.status === "SYNTHETIC") {
      lines.push("*** SYNTHETIC DATA — NOT LIVE MARKET DATA ***");
      lines.push("*** FOR ENGINE VALIDATION ONLY ***");
    }
    lines.push(`Dataset: ${dataset.source}  Status: ${dataset.status}  Timeframe: ${dataset.timeframe}`);
    if (dataset.filename) lines.push(`Filename: ${dataset.filename}`);
    lines.push("");
  }
  lines.push(report.summary, "");
  lines.push(`Total Trades: ${r.totalTrades}`);
  lines.push(`Win Rate: ${(r.winRate * 100).toFixed(1)}%   Loss Rate: ${(r.lossRate * 100).toFixed(1)}%`);
  lines.push(`Profit Factor: ${r.profitFactor.toFixed(2)}   Expectancy: ${r.expectancy.toFixed(2)}`);
  lines.push(`Total P&L: ${r.totalPnl.toFixed(2)}   Max DD: ${r.maxDrawdown.toFixed(2)} (${r.maxDrawdownPct.toFixed(1)}%)`);
  lines.push(`Avg Hold: ${r.avgHoldBars.toFixed(1)} bars`, "");
  lines.push("STRENGTHS"); report.strengths.forEach((s) => lines.push(`  • ${s}`));
  lines.push("", "WEAKNESSES"); report.weaknesses.forEach((s) => lines.push(`  • ${s}`));
  lines.push("", "RISK"); report.risk.forEach((s) => lines.push(`  • ${s}`));
  lines.push("", "IMPROVEMENTS"); report.improvements.forEach((s) => lines.push(`  • ${s}`));
  lines.push("", "ASSUMPTIONS"); r.assumptions.forEach((s) => lines.push(`  • ${s}`));
  return lines.join("\n");
}