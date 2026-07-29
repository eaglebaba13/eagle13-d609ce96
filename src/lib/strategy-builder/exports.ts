// Phase 51 — Export helpers (CSV / JSON / plain-text PDF payload).
import type { BacktestResult, Strategy, StrategyReport } from "./types";

export function tradesToCsv(r: BacktestResult): string {
  const header = "entryTime,exitTime,side,entryPrice,exitPrice,pnl,pnlPct,holdBars,exitReason";
  const rows = r.trades.map((t) =>
    [new Date(t.entryTime).toISOString(), new Date(t.exitTime).toISOString(),
     t.side, t.entryPrice.toFixed(2), t.exitPrice.toFixed(2),
     t.pnl.toFixed(2), t.pnlPct.toFixed(2), t.holdBars, t.exitReason].join(","),
  );
  return [header, ...rows].join("\n");
}

export function backtestToJson(strategy: Strategy, r: BacktestResult, report: StrategyReport): string {
  return JSON.stringify({ strategy, result: r, report }, null, 2);
}

export function reportToPrintable(strategy: Strategy, r: BacktestResult, report: StrategyReport): string {
  const lines: string[] = [];
  lines.push(`STRATEGY REPORT — ${strategy.name}`);
  lines.push("=".repeat(60));
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