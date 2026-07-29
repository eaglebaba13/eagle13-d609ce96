// Phase 51 — Backtest engine. Pure & deterministic.
import type { Bar, BacktestResult, BacktestTrade, MonthlyReturn, Strategy } from "./types";
import { evaluateGroup } from "./evaluator";

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function runBacktest(strategy: Strategy, bars: readonly Bar[]): BacktestResult {
  const startedAt = Date.now();
  const trades: BacktestTrade[] = [];
  const equityCurve: { t: number; equity: number }[] = [];
  const drawdownCurve: { t: number; dd: number }[] = [];
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  let openSide: "CALL" | "PUT" | null = null;
  let entryPrice = 0;
  let entryTime = 0;
  let entryBar = 0;
  const risk = strategy.risk ?? {};
  const targetPct = risk.targetPct ?? Infinity;
  const stopPct = risk.stopPct ?? Infinity;
  const trailPct = risk.trailingStopPct ?? Infinity;
  let trailAnchor = 0;
  const maxTrades = risk.maxTrades ?? Infinity;

  const closeTrade = (bar: Bar, price: number, reason: BacktestTrade["exitReason"], i: number) => {
    if (!openSide) return;
    const direction = openSide === "CALL" ? 1 : -1;
    const pnl = (price - entryPrice) * direction;
    const pnlPct = entryPrice > 0 ? (pnl / entryPrice) * 100 : 0;
    trades.push({
      entryTime, exitTime: bar.t, side: openSide,
      entryPrice, exitPrice: price, pnl, pnlPct,
      holdBars: i - entryBar, exitReason: reason,
    });
    equity += pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
    openSide = null;
  };

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    // Manage open position first.
    if (openSide) {
      const direction = openSide === "CALL" ? 1 : -1;
      const move = ((bar.close - entryPrice) / entryPrice) * 100 * direction;
      // Update trailing anchor.
      if (direction === 1 && bar.high > trailAnchor) trailAnchor = bar.high;
      if (direction === -1 && bar.low < trailAnchor) trailAnchor = bar.low;
      const trailMove = direction === 1
        ? ((trailAnchor - bar.close) / trailAnchor) * 100
        : ((bar.close - trailAnchor) / trailAnchor) * 100;
      if (move >= targetPct) { closeTrade(bar, bar.close, "TARGET", i); }
      else if (-move >= stopPct) { closeTrade(bar, bar.close, "STOP", i); }
      else if (Number.isFinite(trailPct) && trailMove >= trailPct) { closeTrade(bar, bar.close, "TRAIL", i); }
      else if (strategy.exit && evaluateGroup(strategy.exit, bar.indicators)) { closeTrade(bar, bar.close, "SIGNAL", i); }
    }

    // Consider new entry.
    if (!openSide && trades.length < maxTrades) {
      const entryFired = evaluateGroup(strategy.entry, bar.indicators);
      if (entryFired) {
        if (strategy.action.kind === "BUY_CALL" || strategy.action.kind === "BUY_PUT") {
          openSide = strategy.action.kind === "BUY_CALL" ? "CALL" : "PUT";
          entryPrice = bar.close;
          entryTime = bar.t;
          entryBar = i;
          trailAnchor = bar.close;
        }
      }
    }

    equityCurve.push({ t: bar.t, equity });
    drawdownCurve.push({ t: bar.t, dd: peak - equity });
  }

  // Force-close at end (EOD).
  if (openSide && bars.length > 0) closeTrade(bars[bars.length - 1], bars[bars.length - 1].close, "EOD", bars.length - 1);

  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const grossWin = trades.filter((t) => t.pnl > 0).reduce((a, b) => a + b.pnl, 0);
  const grossLoss = -trades.filter((t) => t.pnl < 0).reduce((a, b) => a + b.pnl, 0);
  const total = trades.length;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Number.POSITIVE_INFINITY : 0;
  const totalPnl = trades.reduce((a, b) => a + b.pnl, 0);
  const expectancy = total > 0 ? totalPnl / total : 0;
  const avgHoldBars = total > 0 ? trades.reduce((a, b) => a + b.holdBars, 0) / total : 0;
  const maxDrawdownPct = peak > 0 ? (maxDD / peak) * 100 : 0;

  const byMonth = new Map<string, number>();
  for (const t of trades) {
    const k = monthKey(t.exitTime);
    byMonth.set(k, (byMonth.get(k) ?? 0) + t.pnl);
  }
  const monthlyReturns: MonthlyReturn[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl }));

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    startedAt,
    finishedAt: Date.now(),
    totalTrades: total,
    wins, losses,
    winRate: total > 0 ? wins / total : 0,
    lossRate: total > 0 ? losses / total : 0,
    profitFactor,
    expectancy,
    totalPnl,
    maxDrawdown: maxDD,
    maxDrawdownPct,
    avgHoldBars,
    monthlyReturns,
    equityCurve,
    drawdownCurve,
    trades,
    assumptions: [
      "Independent Phase 51 module — does not modify upstream engines.",
      "Single-position, market-on-close execution; no slippage or fees modelled.",
      "Missing indicator values disable referencing conditions rather than fabricating data.",
    ],
  };
}