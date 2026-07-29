// Phase 49 — Institutional Intelligence LIVE
// Provider-neutral types. Analytical layer only. No fabrication.

export type LiveStatus =
  | "LIVE"
  | "RESEARCH"
  | "PROVIDER_PENDING"
  | "OFFICIAL_SOURCE_REQUIRED"
  | "UNAVAILABLE";

export type IntelligenceBias =
  | "STRONG_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "STRONG_BEARISH";

export interface QuoteSnapshot {
  readonly symbol: string;
  readonly last: number | null;
  readonly changePct: number | null;
}

export interface WeightedStockRow {
  readonly symbol: string;
  readonly displayName: string;
  readonly weight: number; // 0..1 within the top-10 basket
  readonly changePct: number | null;
  readonly contribution: number; // weight * changePct (null-safe as 0)
}

export interface WeightedBreadthResult {
  readonly rows: readonly WeightedStockRow[];
  readonly positiveWeightPct: number; // 0..100
  readonly negativeWeightPct: number; // 0..100
  readonly weightedBreadthScore: number; // -1..+1 (contribution sum, then /|max|)
  readonly coverage: number; // 0..1 (share of weights with a valid quote)
  readonly status: LiveStatus;
  readonly reason: string | null;
}

export interface Nifty50BreadthResult {
  readonly advancing: number;
  readonly declining: number;
  readonly unchanged: number;
  readonly total: number;
  readonly breadthPct: number; // (adv-dec)/total * 100
  readonly advanceDeclineRatio: number | null;
  readonly status: LiveStatus;
  readonly reason: string | null;
}

export interface SectorStrengthRow {
  readonly id: string;
  readonly label: string;
  readonly changePct: number | null;
  readonly bias: "BULLISH" | "NEUTRAL" | "BEARISH" | "UNAVAILABLE";
  readonly strengthPct: number | null; // 0..100 scaled from changePct
}

export interface SectorRotationResult {
  readonly rows: readonly SectorStrengthRow[];
  readonly leaders: readonly SectorStrengthRow[]; // top 3 bullish
  readonly laggards: readonly SectorStrengthRow[]; // bottom 3 bearish
  readonly bullishCount: number;
  readonly neutralCount: number;
  readonly bearishCount: number;
  readonly rotationBias: number; // -1..+1
  readonly coverage: number; // 0..1
  readonly status: LiveStatus;
  readonly reason: string | null;
}

export interface InstitutionalFlowResult {
  readonly tradeDate: string | null;
  readonly fiiNet: number | null;
  readonly diiNet: number | null;
  readonly status: LiveStatus;
  readonly reason: string;
}

export interface NewsSentimentResult {
  readonly positive: number;
  readonly neutral: number;
  readonly negative: number;
  readonly marketImpact: "LOW" | "MEDIUM" | "HIGH" | "UNAVAILABLE";
  readonly confidence: number; // 0..1
  readonly status: LiveStatus;
  readonly reason: string;
}

export interface IntelligenceScoreInput {
  readonly weightedBreadthScore?: number | null; // -1..+1
  readonly nifty50BreadthPct?: number | null; // -100..+100
  readonly sectorRotationBias?: number | null; // -1..+1
  readonly fiiDiiBias?: number | null; // -1..+1
  readonly vix?: number | null;
  readonly combinedPcr?: number | null;
  readonly globalCompositeBiasPct?: number | null; // -1..+1
}

export interface IntelligenceScoreResult {
  readonly score: number; // 0..100 (50 = neutral)
  readonly bias: IntelligenceBias;
  readonly confidence: number; // 0..1 = input coverage
  readonly contributions: readonly { readonly key: string; readonly weight: number; readonly value: number }[];
  readonly missing: readonly string[];
  readonly explanation: string;
}

export interface InstitutionalIntelligenceSnapshot {
  readonly generatedAt: string;
  readonly weightedBreadth: WeightedBreadthResult;
  readonly nifty50Breadth: Nifty50BreadthResult;
  readonly sectors: SectorRotationResult;
  readonly flow: InstitutionalFlowResult;
  readonly news: NewsSentimentResult;
  readonly score: IntelligenceScoreResult;
  readonly overallStatus: LiveStatus;
}