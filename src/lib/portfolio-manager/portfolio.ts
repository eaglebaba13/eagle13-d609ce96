// Phase 52 — Portfolio computations. Pure & deterministic.

import type {
  PnlLedgerRow,
  PortfolioState,
  PortfolioSummary,
  Position,
} from "./types";

export function positionPnl(p: Position): number {
  const price = p.status === "CLOSED" && p.exitPrice != null ? p.exitPrice : p.currentPrice;
  const sign = p.direction === "PUT" || p.direction === "SHORT" ? -1 : 1;
  return (price - p.entryPrice) * p.quantity * sign;
}

export function positionExposure(p: Position): number {
  const price = p.status === "CLOSED" && p.exitPrice != null ? p.exitPrice : p.currentPrice;
  return Math.abs(price * p.quantity);
}

export function positionRiskAmount(p: Position): number {
  if (p.stopLoss == null) return 0;
  const perUnit = Math.abs(p.entryPrice - p.stopLoss);
  return perUnit * p.quantity;
}

export function positionRewardRisk(p: Position): number | null {
  if (p.stopLoss == null || p.target == null) return null;
  const risk = Math.abs(p.entryPrice - p.stopLoss);
  const reward = Math.abs(p.target - p.entryPrice);
  return risk > 0 ? reward / risk : null;
}

function pnlWithin(ledger: readonly PnlLedgerRow[], ms: number, now: number): number {
  let sum = 0;
  for (const r of ledger) {
    const t = Date.parse(r.ts);
    if (!Number.isFinite(t)) continue;
    if (now - t <= ms) sum += r.pnl;
  }
  return sum;
}

export function computePortfolioSummary(
  state: PortfolioState,
  now: number = Date.now(),
): PortfolioSummary {
  const open = state.positions.filter((p) => p.status === "OPEN");
  const closed = state.positions.filter((p) => p.status === "CLOSED");
  const invested = open.reduce((s, p) => s + Math.abs(p.entryPrice * p.quantity), 0);
  const unrealized = open.reduce((s, p) => s + positionPnl(p), 0);
  const realized =
    closed.reduce((s, p) => s + positionPnl(p), 0) +
    state.ledger.reduce((s, r) => s + r.pnl, 0);
  const totalReturn = state.totalCapital > 0 ? ((unrealized + realized) / state.totalCapital) * 100 : 0;

  return {
    totalCapital: state.totalCapital,
    investedCapital: invested,
    availableCapital: Math.max(0, state.totalCapital - invested),
    unrealizedPnl: unrealized,
    realizedPnl: realized,
    dailyPnl: pnlWithin(state.ledger, 86_400_000, now),
    weeklyPnl: pnlWithin(state.ledger, 7 * 86_400_000, now),
    monthlyPnl: pnlWithin(state.ledger, 30 * 86_400_000, now),
    totalReturnPct: totalReturn,
    openPositions: open.length,
    closedPositions: closed.length,
  };
}