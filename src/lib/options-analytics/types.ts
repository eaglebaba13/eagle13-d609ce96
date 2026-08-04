// Phase 54 — Institutional Options Analytics (Research Layer).
// Provider-neutral, deterministic, additive types. No `any`.

import type { OptionChainSnapshot } from "@/lib/option-chain/types";

export type Availability = "OK" | "PARTIAL" | "UNAVAILABLE";

export type OiBuildupClass =
  | "LONG_BUILDUP"
  | "SHORT_BUILDUP"
  | "LONG_UNWINDING"
  | "SHORT_COVERING"
  | "NEUTRAL"
  | "UNAVAILABLE";

export type DealerPosture = "LONG_GAMMA" | "SHORT_GAMMA" | "NEUTRAL" | "UNAVAILABLE";
export type HedgingPressure = "SUPPRESSIVE" | "AMPLIFYING" | "NEUTRAL" | "UNAVAILABLE";
export type DirectionalBias = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNAVAILABLE";
export type VolExpectation = "LOW" | "NORMAL" | "HIGH" | "UNAVAILABLE";

export type IvRegime = "LOW" | "NORMAL" | "HIGH" | "EXTREME" | "UNAVAILABLE";

export type MarketStructure =
  | "TRENDING"
  | "BALANCED"
  | "COMPRESSION"
  | "EXPANSION"
  | "HIGH_VOLATILITY"
  | "UNAVAILABLE";

export interface MaxPainSummary {
  readonly strike: number | null;
  readonly distanceFromSpot: number | null;
  readonly distanceFromSpotPct: number | null;
  readonly dailyChange: number | null;
  readonly perStrikePain: ReadonlyArray<{ strike: number; pain: number }>;
  readonly confidence: number;
  readonly availability: Availability;
}

export interface GammaExposureSummary {
  readonly totalGamma: number | null;
  readonly callGamma: number | null;
  readonly putGamma: number | null;
  readonly netGamma: number | null;
  readonly cumulativeGamma: ReadonlyArray<{ strike: number; cum: number }>;
  readonly positiveGammaStrikes: readonly number[];
  readonly negativeGammaStrikes: readonly number[];
  readonly gammaFlipStrike: number | null;
  readonly availability: Availability;
  readonly reason: string;
}

export interface GammaWallsSummary {
  readonly upperWall: number | null;
  readonly lowerWall: number | null;
  readonly strongestWall: number | null;
  readonly wallStrength: number | null;
  readonly availability: Availability;
}

export interface DealerPositioningSummary {
  readonly posture: DealerPosture;
  readonly hedgingPressure: HedgingPressure;
  readonly directionalBias: DirectionalBias;
  readonly volatilityExpectation: VolExpectation;
  readonly netGamma: number | null;
  readonly availability: Availability;
}

export interface OiBuildupRow {
  readonly strike: number;
  readonly side: "CALL" | "PUT";
  readonly oi: number | null;
  readonly changeOi: number | null;
  readonly ltp: number | null;
  readonly classification: OiBuildupClass;
}

export interface OiBuildupSummary {
  readonly rows: readonly OiBuildupRow[];
  readonly dominant: OiBuildupClass;
  readonly availability: Availability;
}

export interface IvAnalyticsSummary {
  readonly atmIv: number | null;
  readonly ivRank: number | null;       // 0..100
  readonly ivPercentile: number | null; // 0..100
  readonly regime: IvRegime;
  readonly sampleSize: number;
  readonly availability: Availability;
}

export interface ExpectedMoveSummary {
  readonly atmIv: number | null;
  readonly daysToExpiry: number | null;
  readonly upperBand: number | null;
  readonly lowerBand: number | null;
  readonly expectedRange: number | null;
  readonly availability: Availability;
}

export interface SupportResistanceLevel {
  readonly strike: number;
  readonly kind: "SUPPORT" | "RESISTANCE";
  readonly weight: number;
  readonly sources: readonly string[];
}

export interface SupportResistanceSummary {
  readonly levels: readonly SupportResistanceLevel[];
  readonly availability: Availability;
}

export interface MarketStructureSummary {
  readonly regime: MarketStructure;
  readonly rationale: string;
  readonly availability: Availability;
}

export interface ConfidenceBreakdown {
  readonly providerQuality: number;
  readonly chainCompleteness: number;
  readonly ivAvailability: number;
  readonly oiQuality: number;
  readonly gammaCompleteness: number;
  readonly expiryValidity: number;
}

export interface ConfidenceSummary {
  readonly score: number; // 0..100
  readonly breakdown: ConfidenceBreakdown;
  readonly missing: readonly string[];
}

export interface OptionsAnalyticsReport {
  readonly generatedAt: string;
  readonly instrument: string;
  readonly expiry: string | null;
  readonly spotPrice: number | null;
  readonly provider: string;
  readonly maxPain: MaxPainSummary;
  readonly gammaExposure: GammaExposureSummary;
  readonly gammaWalls: GammaWallsSummary;
  readonly dealer: DealerPositioningSummary;
  readonly buildup: OiBuildupSummary;
  readonly iv: IvAnalyticsSummary;
  readonly expectedMove: ExpectedMoveSummary;
  readonly supportResistance: SupportResistanceSummary;
  readonly marketStructure: MarketStructureSummary;
  readonly confidence: ConfidenceSummary;
}

export interface AnalyticsInputs {
  readonly snapshot: OptionChainSnapshot;
  readonly priorMaxPain?: number | null;
  readonly ivHistory?: readonly number[];
  readonly now?: Date;
}