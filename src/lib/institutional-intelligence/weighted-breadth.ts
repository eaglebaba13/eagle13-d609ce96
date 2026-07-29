// Phase 49 — Weighted breadth from the NIFTY50 top-10 basket.
// Pure function: caller injects quotes so this is trivially testable
// and the same code path runs in server, worker and tests.

import { TOP10_REGISTRY, type Top10Constituent } from "./top10-registry";
import type { QuoteSnapshot, WeightedBreadthResult, WeightedStockRow, Nifty50BreadthResult, LiveStatus } from "./types";

function pick(sym: string, quotes: readonly QuoteSnapshot[]): QuoteSnapshot | null {
  return quotes.find((q) => q.symbol === sym) ?? null;
}

export function computeWeightedBreadth(
  quotes: readonly QuoteSnapshot[],
  registry: readonly Top10Constituent[] = TOP10_REGISTRY,
): WeightedBreadthResult {
  const rows: WeightedStockRow[] = [];
  let posW = 0;
  let negW = 0;
  let covered = 0;
  let contribSum = 0;

  for (const c of registry) {
    const q = pick(c.yahooSymbol, quotes) ?? pick(c.symbol, quotes);
    const chg = q?.changePct ?? null;
    const contribution = chg == null ? 0 : (chg / 100) * c.weight;
    rows.push({
      symbol: c.symbol,
      displayName: c.displayName,
      weight: c.weight,
      changePct: chg,
      contribution,
    });
    if (chg != null) {
      covered += c.weight;
      contribSum += contribution;
      if (chg > 0) posW += c.weight;
      else if (chg < 0) negW += c.weight;
    }
  }

  const totalW = registry.reduce((s, c) => s + c.weight, 0) || 1;
  const coverage = covered / totalW;

  // Scale contribution to a bounded [-1..+1] band (assume ~3% move = full band).
  const CAP = 0.03;
  const scaled = Math.max(-1, Math.min(1, contribSum / CAP));

  let status: LiveStatus;
  let reason: string | null = null;
  if (coverage >= 0.8) status = "LIVE";
  else if (coverage > 0) { status = "PROVIDER_PENDING"; reason = `Partial coverage: ${(coverage * 100).toFixed(0)}%`; }
  else { status = "PROVIDER_PENDING"; reason = "No quotes returned by Yahoo Finance"; }

  return {
    rows,
    positiveWeightPct: Math.round((posW / totalW) * 100),
    negativeWeightPct: Math.round((negW / totalW) * 100),
    weightedBreadthScore: Math.round(scaled * 100) / 100,
    coverage: Math.round(coverage * 100) / 100,
    status,
    reason,
  };
}

export function computeNifty50Breadth(quotes: readonly QuoteSnapshot[]): Nifty50BreadthResult {
  let adv = 0;
  let dec = 0;
  let unc = 0;
  for (const q of quotes) {
    if (q.changePct == null) continue;
    if (q.changePct > 0) adv++;
    else if (q.changePct < 0) dec++;
    else unc++;
  }
  const total = adv + dec + unc;
  if (total === 0) {
    return {
      advancing: 0, declining: 0, unchanged: 0, total: 0,
      breadthPct: 0, advanceDeclineRatio: null,
      status: "PROVIDER_PENDING",
      reason: "No NIFTY50 constituent quotes available",
    };
  }
  const breadthPct = Math.round(((adv - dec) / total) * 1000) / 10;
  const ratio = dec === 0 ? null : Math.round((adv / dec) * 100) / 100;
  const status: LiveStatus = total >= 40 ? "LIVE" : total >= 10 ? "PROVIDER_PENDING" : "PROVIDER_PENDING";
  const reason = total < 40 ? `Only ${total} constituents resolved` : null;
  return {
    advancing: adv, declining: dec, unchanged: unc, total,
    breadthPct, advanceDeclineRatio: ratio,
    status, reason,
  };
}