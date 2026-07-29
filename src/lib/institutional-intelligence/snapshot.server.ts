// Phase 49 — Composed live Institutional Intelligence snapshot.
// Server-only: fetches quotes and composes deterministic analytics.

import { TOP10_REGISTRY } from "./top10-registry";
import { II_SECTOR_REGISTRY } from "./sector-registry";
import { computeNifty50Breadth, computeWeightedBreadth } from "./weighted-breadth";
import { computeSectorRotation } from "./sector-strength";
import { computeIntelligenceScore } from "./score";
import { RESEARCH_FLOW, RESEARCH_NEWS } from "./index";
import { fetchYahooQuotes } from "./yahoo-quote.server";
import { NIFTY50_CONSTITUENTS } from "@/lib/market-breadth/nifty50-registry";
import type {
  InstitutionalIntelligenceSnapshot,
  IntelligenceScoreInput,
  LiveStatus,
} from "./types";

function overall(...statuses: LiveStatus[]): LiveStatus {
  const live = statuses.filter((s) => s === "LIVE").length;
  const any = statuses.length;
  if (live === any) return "LIVE";
  if (live === 0) return "PROVIDER_PENDING";
  return "RESEARCH";
}

function yahooSymbolFor(nseSymbol: string): string {
  return nseSymbol.startsWith("^") ? nseSymbol : `${nseSymbol}.NS`;
}

export interface BuildSnapshotDeps {
  readonly vix?: number | null;
  readonly combinedPcr?: number | null;
  readonly globalCompositeBiasPct?: number | null;
}

export async function buildInstitutionalIntelligenceSnapshot(
  deps: BuildSnapshotDeps = {},
): Promise<InstitutionalIntelligenceSnapshot> {
  const generatedAt = new Date().toISOString();

  const top10Syms = TOP10_REGISTRY.map((c) => c.yahooSymbol);
  const sectorSyms = II_SECTOR_REGISTRY.map((s) => s.yahooSymbol);
  const n50Syms = NIFTY50_CONSTITUENTS.map((c) => yahooSymbolFor(c.symbol));

  const [top10Quotes, sectorQuotes, n50Quotes] = await Promise.all([
    fetchYahooQuotes(top10Syms),
    fetchYahooQuotes(sectorSyms),
    fetchYahooQuotes(n50Syms),
  ]);

  const weightedBreadth = computeWeightedBreadth(top10Quotes);
  const nifty50Breadth = computeNifty50Breadth(n50Quotes);
  const sectors = computeSectorRotation(sectorQuotes);

  const scoreInput: IntelligenceScoreInput = {
    weightedBreadthScore: weightedBreadth.status === "LIVE" ? weightedBreadth.weightedBreadthScore : null,
    nifty50BreadthPct: nifty50Breadth.status === "LIVE" ? nifty50Breadth.breadthPct : null,
    sectorRotationBias: sectors.status === "LIVE" ? sectors.rotationBias : null,
    fiiDiiBias: null,
    vix: deps.vix ?? null,
    combinedPcr: deps.combinedPcr ?? null,
    globalCompositeBiasPct: deps.globalCompositeBiasPct ?? null,
  };
  const score = computeIntelligenceScore(scoreInput);

  return {
    generatedAt,
    weightedBreadth,
    nifty50Breadth,
    sectors,
    flow: RESEARCH_FLOW,
    news: RESEARCH_NEWS,
    score,
    overallStatus: overall(weightedBreadth.status, nifty50Breadth.status, sectors.status),
  };
}