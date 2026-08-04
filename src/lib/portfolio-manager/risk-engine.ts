// Phase 52 — Risk Engine. Pure & deterministic.

import { computePortfolioSummary, positionExposure, positionRiskAmount } from "./portfolio";
import type { PortfolioState, Position } from "./types";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskLimits {
  readonly maxRiskPerTradePct: number; // e.g. 2 = 2 %
  readonly maxPortfolioRiskPct: number; // e.g. 6
  readonly maxDailyLossPct: number; // e.g. 3
  readonly maxWeeklyLossPct: number; // e.g. 8
  readonly maxExposurePct: number; // e.g. 100
}

export const DEFAULT_LIMITS: RiskLimits = {
  maxRiskPerTradePct: 2,
  maxPortfolioRiskPct: 6,
  maxDailyLossPct: 3,
  maxWeeklyLossPct: 8,
  maxExposurePct: 100,
};

export interface PortfolioRiskReport {
  readonly portfolioRiskAmount: number;
  readonly portfolioRiskPct: number;
  readonly exposureAmount: number;
  readonly exposurePct: number;
  readonly dailyLossPct: number;
  readonly weeklyLossPct: number;
  readonly maxDrawdownPct: number;
  readonly perPosition: ReadonlyArray<{
    readonly id: string;
    readonly riskAmount: number;
    readonly riskPct: number;
    readonly exposurePct: number;
  }>;
  readonly level: RiskLevel;
  readonly breaches: readonly string[];
}

function maxDrawdownPct(state: PortfolioState): number {
  const cap = state.totalCapital || 1;
  let equity = cap;
  let peak = cap;
  let dd = 0;
  const sorted = [...state.ledger].sort((a, b) => a.ts.localeCompare(b.ts));
  for (const r of sorted) {
    equity += r.pnl;
    if (equity > peak) peak = equity;
    const cur = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (cur > dd) dd = cur;
  }
  return dd;
}

export function computeRiskReport(
  state: PortfolioState,
  limits: RiskLimits = DEFAULT_LIMITS,
  now: number = Date.now(),
): PortfolioRiskReport {
  const cap = state.totalCapital || 1;
  const summary = computePortfolioSummary(state, now);
  const open = state.positions.filter((p) => p.status === "OPEN");
  const perPosition = open.map((p) => {
    const risk = positionRiskAmount(p);
    const exposure = positionExposure(p);
    return {
      id: p.id,
      riskAmount: risk,
      riskPct: (risk / cap) * 100,
      exposurePct: (exposure / cap) * 100,
    };
  });
  const portfolioRisk = perPosition.reduce((s, x) => s + x.riskAmount, 0);
  const exposureAmount = open.reduce((s, p) => s + positionExposure(p), 0);
  const portfolioRiskPct = (portfolioRisk / cap) * 100;
  const exposurePct = (exposureAmount / cap) * 100;
  const dailyLossPct = summary.dailyPnl < 0 ? (-summary.dailyPnl / cap) * 100 : 0;
  const weeklyLossPct = summary.weeklyPnl < 0 ? (-summary.weeklyPnl / cap) * 100 : 0;
  const dd = maxDrawdownPct(state);

  const breaches: string[] = [];
  for (const p of perPosition) {
    if (p.riskPct > limits.maxRiskPerTradePct)
      breaches.push(`Position ${p.id}: risk ${p.riskPct.toFixed(2)}% > cap ${limits.maxRiskPerTradePct}%`);
  }
  if (portfolioRiskPct > limits.maxPortfolioRiskPct)
    breaches.push(`Portfolio risk ${portfolioRiskPct.toFixed(2)}% > cap ${limits.maxPortfolioRiskPct}%`);
  if (exposurePct > limits.maxExposurePct)
    breaches.push(`Exposure ${exposurePct.toFixed(2)}% > cap ${limits.maxExposurePct}%`);
  if (dailyLossPct > limits.maxDailyLossPct)
    breaches.push(`Daily loss ${dailyLossPct.toFixed(2)}% > cap ${limits.maxDailyLossPct}%`);
  if (weeklyLossPct > limits.maxWeeklyLossPct)
    breaches.push(`Weekly loss ${weeklyLossPct.toFixed(2)}% > cap ${limits.maxWeeklyLossPct}%`);

  let level: RiskLevel = "LOW";
  const ratio = limits.maxPortfolioRiskPct > 0 ? portfolioRiskPct / limits.maxPortfolioRiskPct : 0;
  if (breaches.length > 0 || ratio >= 1) level = "CRITICAL";
  else if (ratio >= 0.75) level = "HIGH";
  else if (ratio >= 0.4) level = "MEDIUM";

  return {
    portfolioRiskAmount: portfolioRisk,
    portfolioRiskPct,
    exposureAmount,
    exposurePct,
    dailyLossPct,
    weeklyLossPct,
    maxDrawdownPct: dd,
    perPosition,
    level,
    breaches,
  };
}

// -------- Position sizing calculator ----------

export interface SizingInput {
  readonly capital: number;
  readonly riskPct: number; // e.g. 1 = 1 %
  readonly entry: number;
  readonly stopLoss: number;
  readonly lotSize?: number;
  readonly maxCapitalPct?: number; // upper bound on capital allocation
}

export interface SizingResult {
  readonly recommendedQuantity: number;
  readonly lots: number;
  readonly maxCapitalAllocation: number;
  readonly maxLoss: number;
  readonly perUnitRisk: number;
  readonly valid: boolean;
  readonly reason?: string;
}

export function computePositionSize(input: SizingInput): SizingResult {
  const lot = Math.max(1, Math.floor(input.lotSize ?? 1));
  const cap = input.capital;
  const riskPct = input.riskPct;
  const maxAllocPct = input.maxCapitalPct ?? 100;
  const perUnit = Math.abs(input.entry - input.stopLoss);
  const empty: SizingResult = {
    recommendedQuantity: 0,
    lots: 0,
    maxCapitalAllocation: 0,
    maxLoss: 0,
    perUnitRisk: perUnit,
    valid: false,
  };
  if (!(cap > 0)) return { ...empty, reason: "capital must be > 0" };
  if (!(riskPct > 0)) return { ...empty, reason: "riskPct must be > 0" };
  if (!(input.entry > 0)) return { ...empty, reason: "entry must be > 0" };
  if (!(perUnit > 0)) return { ...empty, reason: "stopLoss must differ from entry" };

  const riskBudget = (cap * riskPct) / 100;
  const rawQty = riskBudget / perUnit;
  const lots = Math.floor(rawQty / lot);
  const qty = lots * lot;
  const alloc = qty * input.entry;
  const maxAlloc = (cap * maxAllocPct) / 100;
  if (qty <= 0)
    return { ...empty, reason: "risk budget too small for one lot" };
  if (alloc > maxAlloc)
    return {
      recommendedQuantity: qty,
      lots,
      maxCapitalAllocation: alloc,
      maxLoss: qty * perUnit,
      perUnitRisk: perUnit,
      valid: false,
      reason: "exceeds max capital allocation",
    };
  return {
    recommendedQuantity: qty,
    lots,
    maxCapitalAllocation: alloc,
    maxLoss: qty * perUnit,
    perUnitRisk: perUnit,
    valid: true,
  };
}

// -------- AI Decision overlay ----------

export interface DecisionOverlayInput {
  readonly action: "BUY_CALL" | "BUY_PUT" | "WAIT" | string;
  readonly entry: number;
  readonly stopLoss: number;
  readonly capital: number;
  readonly riskPct: number;
  readonly currentRiskPct: number;
  readonly limits?: RiskLimits;
}

export interface DecisionOverlayOutput {
  readonly capitalRequired: number;
  readonly suggestedQuantity: number;
  readonly maxLoss: number;
  readonly portfolioImpactPct: number;
  readonly riskLevel: RiskLevel;
  readonly warnings: readonly string[];
}

export function computeDecisionOverlay(input: DecisionOverlayInput): DecisionOverlayOutput {
  const limits = input.limits ?? DEFAULT_LIMITS;
  const sizing = computePositionSize({
    capital: input.capital,
    riskPct: input.riskPct,
    entry: input.entry,
    stopLoss: input.stopLoss,
  });
  const warnings: string[] = [];
  if (input.action === "WAIT") warnings.push("Decision is WAIT — no position suggested.");
  const impact = input.capital > 0 ? (sizing.maxLoss / input.capital) * 100 : 0;
  const projectedRiskPct = input.currentRiskPct + impact;
  if (projectedRiskPct > limits.maxPortfolioRiskPct)
    warnings.push(
      `Adding this trade would push portfolio risk to ${projectedRiskPct.toFixed(2)}% (cap ${limits.maxPortfolioRiskPct}%)`,
    );
  if (!sizing.valid && sizing.reason) warnings.push(sizing.reason);

  let level: RiskLevel = "LOW";
  const ratio = limits.maxPortfolioRiskPct > 0 ? projectedRiskPct / limits.maxPortfolioRiskPct : 0;
  if (ratio >= 1) level = "CRITICAL";
  else if (ratio >= 0.75) level = "HIGH";
  else if (ratio >= 0.4) level = "MEDIUM";

  return {
    capitalRequired: sizing.maxCapitalAllocation,
    suggestedQuantity: sizing.recommendedQuantity,
    maxLoss: sizing.maxLoss,
    portfolioImpactPct: impact,
    riskLevel: level,
    warnings,
  };
}