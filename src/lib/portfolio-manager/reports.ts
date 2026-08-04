// Phase 52 — Portfolio reports & exports. Pure & deterministic.

import { computePortfolioSummary, positionExposure, positionPnl } from "./portfolio";
import { computeRiskReport, type RiskLimits } from "./risk-engine";
import type { PortfolioState } from "./types";

export const REPORT_SCHEMA_VERSION = "52.1";

export interface AllocationRow {
  readonly instrument: string;
  readonly exposure: number;
  readonly pct: number;
}

export interface PortfolioReport {
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly summary: ReturnType<typeof computePortfolioSummary>;
  readonly risk: ReturnType<typeof computeRiskReport>;
  readonly allocation: readonly AllocationRow[];
  readonly performance: {
    readonly winRatePct: number;
    readonly wins: number;
    readonly losses: number;
    readonly avgWin: number;
    readonly avgLoss: number;
    readonly profitFactor: number | null;
  };
}

export function buildAllocation(state: PortfolioState): readonly AllocationRow[] {
  const map = new Map<string, number>();
  for (const p of state.positions) {
    if (p.status !== "OPEN") continue;
    map.set(p.instrument, (map.get(p.instrument) ?? 0) + positionExposure(p));
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map.entries()]
    .map(([instrument, exposure]) => ({ instrument, exposure, pct: (exposure / total) * 100 }))
    .sort((a, b) => b.exposure - a.exposure);
}

export function buildPerformance(state: PortfolioState) {
  const closed = state.positions.filter((p) => p.status === "CLOSED");
  const pnls = closed.map(positionPnl);
  const wins = pnls.filter((v) => v > 0);
  const losses = pnls.filter((v) => v < 0);
  const sumWins = wins.reduce((a, b) => a + b, 0);
  const sumLosses = Math.abs(losses.reduce((a, b) => a + b, 0));
  return {
    winRatePct: pnls.length > 0 ? (wins.length / pnls.length) * 100 : 0,
    wins: wins.length,
    losses: losses.length,
    avgWin: wins.length > 0 ? sumWins / wins.length : 0,
    avgLoss: losses.length > 0 ? -sumLosses / losses.length : 0,
    profitFactor: sumLosses > 0 ? sumWins / sumLosses : null,
  };
}

export function buildReport(
  state: PortfolioState,
  limits?: RiskLimits,
  now: number = Date.now(),
): PortfolioReport {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date(now).toISOString(),
    summary: computePortfolioSummary(state, now),
    risk: computeRiskReport(state, limits, now),
    allocation: buildAllocation(state),
    performance: buildPerformance(state),
  };
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToJson(report: PortfolioReport): string {
  return JSON.stringify(report, null, 2);
}

export function positionsToCsv(state: PortfolioState): string {
  const header = [
    "id","instrument","direction","status","quantity","entry","current","exit","stop","target","pnl","openedAt","closedAt",
  ];
  const rows = state.positions.map((p) =>
    [
      p.id,
      p.instrument,
      p.direction,
      p.status,
      p.quantity,
      p.entryPrice,
      p.currentPrice,
      p.exitPrice ?? "",
      p.stopLoss ?? "",
      p.target ?? "",
      positionPnl(p).toFixed(2),
      p.openedAt,
      p.closedAt ?? "",
    ].map(csvEscape).join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function allocationToCsv(alloc: readonly AllocationRow[]): string {
  const rows = alloc.map((r) => [r.instrument, r.exposure.toFixed(2), r.pct.toFixed(2)].map(csvEscape).join(","));
  return ["instrument,exposure,pct", ...rows].join("\n");
}