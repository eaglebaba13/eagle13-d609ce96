// Phase 51 — Strategy report generator. Deterministic; no LLM.
import type { BacktestResult, StrategyReport } from "./types";

export function generateReport(r: BacktestResult): StrategyReport {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risk: string[] = [];
  const improvements: string[] = [];

  if (r.totalTrades === 0) {
    return {
      summary: `${r.strategyName}: no trades were triggered on the supplied dataset.`,
      strengths: [],
      weaknesses: ["Entry rules did not fire on any bar."],
      risk: ["No live risk — no exposure was taken."],
      improvements: ["Loosen conditions or add OR groups to capture more setups."],
    };
  }
  if (r.winRate >= 0.55) strengths.push(`Win rate ${(r.winRate * 100).toFixed(1)}% ≥ 55%.`);
  else weaknesses.push(`Win rate ${(r.winRate * 100).toFixed(1)}% below 55%.`);
  if (r.profitFactor >= 1.5) strengths.push(`Profit factor ${r.profitFactor.toFixed(2)} ≥ 1.5.`);
  else weaknesses.push(`Profit factor ${r.profitFactor.toFixed(2)} below 1.5.`);
  if (r.expectancy > 0) strengths.push(`Positive expectancy ${r.expectancy.toFixed(2)} / trade.`);
  else weaknesses.push(`Non-positive expectancy ${r.expectancy.toFixed(2)}.`);
  if (r.maxDrawdownPct > 25) risk.push(`Max drawdown ${r.maxDrawdownPct.toFixed(1)}% is elevated.`);
  else risk.push(`Max drawdown ${r.maxDrawdownPct.toFixed(1)}% within tolerance.`);
  if (r.avgHoldBars > 20) improvements.push("Long average hold — consider tighter trailing stops.");
  if (r.winRate < 0.5) improvements.push("Add a confirmation indicator to filter false positives.");
  if (r.profitFactor < 1.2) improvements.push("Raise target or lower stop to improve payoff ratio.");
  return {
    summary: `${r.strategyName}: ${r.totalTrades} trades, net P&L ${r.totalPnl.toFixed(2)}, PF ${r.profitFactor.toFixed(2)}.`,
    strengths, weaknesses, risk, improvements,
  };
}