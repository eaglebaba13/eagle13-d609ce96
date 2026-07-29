// Phase 54 — Options Analytics (Research Layer). Client-safe.
export * from "./types";
export * from "./max-pain";
export * from "./gamma-exposure";
export * from "./gamma-walls";
export * from "./dealer-positioning";
export * from "./oi-buildup";
export * from "./iv-rank";
export * from "./iv-percentile";
export * from "./expected-move";
export * from "./volatility-regime";
export * from "./support-resistance";
export * from "./market-structure";
export * from "./confidence";
export * from "./reports";

import type { AnalyticsInputs, OptionsAnalyticsReport } from "./types";
import { computeMaxPain } from "./max-pain";
import { computeGammaExposure } from "./gamma-exposure";
import { computeGammaWalls } from "./gamma-walls";
import { computeDealerPositioning } from "./dealer-positioning";
import { computeOiBuildup } from "./oi-buildup";
import { computeIvRank } from "./iv-rank";
import { computeIvPercentile } from "./iv-percentile";
import { classifyIvRegime } from "./volatility-regime";
import { computeExpectedMove, atmIvOf } from "./expected-move";
import { computeSupportResistance } from "./support-resistance";
import { computeMarketStructure } from "./market-structure";
import { computeConfidence } from "./confidence";

export function buildOptionsAnalyticsReport(inputs: AnalyticsInputs): OptionsAnalyticsReport {
  const { snapshot, priorMaxPain = null, ivHistory = [], now = new Date() } = inputs;
  const maxPain = computeMaxPain(snapshot, priorMaxPain);
  const gex = computeGammaExposure(snapshot);
  const walls = computeGammaWalls(gex, snapshot.spotPrice);
  const dealer = computeDealerPositioning(gex, snapshot.spotPrice);
  const buildup = computeOiBuildup(snapshot);
  const atmIv = atmIvOf(snapshot);
  const rank = computeIvRank(atmIv, ivHistory);
  const pct = computeIvPercentile(atmIv, ivHistory);
  const regime = classifyIvRegime(rank.rank);
  const iv = {
    atmIv,
    ivRank: rank.rank,
    ivPercentile: pct.pct,
    regime: regime.regime,
    sampleSize: rank.sampleSize,
    availability: rank.availability,
  } as const;
  const em = computeExpectedMove(snapshot, now);
  const sr = computeSupportResistance(snapshot, walls, maxPain, dealer);
  const ms = computeMarketStructure(em, dealer, iv);
  const confidence = computeConfidence(snapshot, gex, iv);
  return {
    generatedAt: now.toISOString(),
    instrument: snapshot.instrument,
    expiry: snapshot.expiry ?? null,
    spotPrice: snapshot.spotPrice,
    provider: snapshot.provider,
    maxPain,
    gammaExposure: gex,
    gammaWalls: walls,
    dealer,
    buildup,
    iv,
    expectedMove: em,
    supportResistance: sr,
    marketStructure: ms,
    confidence,
  };
}