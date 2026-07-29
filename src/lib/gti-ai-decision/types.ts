// Phase 50 — GTI AI Decision Engine (pure orchestration types).
//
// This layer never recomputes upstream analytics. It consumes outputs
// from the existing Decision Intelligence Engine and Institutional
// Intelligence layer and reduces them into a single institutional-grade
// trading recommendation.

export type GtiAction = "BUY_CALL" | "BUY_PUT" | "WAIT";

export type ConfidenceBand = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";

export type TradeQuality = "EXCELLENT" | "GOOD" | "AVERAGE" | "AVOID";

export type GtiRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type ReasonPolarity = "BULL" | "BEAR" | "NEUTRAL";

export interface GtiReason {
  readonly key: string;
  readonly label: string;
  readonly polarity: ReasonPolarity;
  readonly detail: string;
}

export interface GtiRiskPlan {
  readonly level: GtiRiskLevel;
  readonly entryZone: { readonly low: number; readonly high: number } | null;
  readonly stopLoss: number | null;
  readonly target1: number | null;
  readonly target2: number | null;
  readonly unit: "INDEX_POINTS" | null;
  readonly unavailableReason: string | null;
  readonly notes: readonly string[];
}

export interface GtiTimeline {
  readonly previousAction: GtiAction | null;
  readonly previousGeneratedAt: string | null;
  readonly currentAction: GtiAction;
  readonly currentGeneratedAt: string;
  readonly decisionChanged: boolean;
  readonly dataFreshnessSec: number | null;
}

/** Institutional Intelligence input reduced to what the orchestrator needs. */
export interface GtiInstitutionalInput {
  readonly score: number; // 0..100 (50 = neutral)
  readonly bias:
    | "STRONG_BULLISH"
    | "BULLISH"
    | "NEUTRAL"
    | "BEARISH"
    | "STRONG_BEARISH";
  readonly confidence: number; // 0..1 (input coverage)
  readonly available: boolean;
  readonly note?: string;
}

/** Decision Intelligence Engine input reduced to what the orchestrator needs. */
export interface GtiDecisionInput {
  readonly action: "STRONG_BUY_CE" | "BUY_CE" | "WAIT" | "BUY_PE" | "STRONG_BUY_PE";
  readonly confidence: number; // 0..100
  readonly riskLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  readonly contributions: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly bias: "BULL" | "BEAR" | "NEUTRAL";
    readonly present: boolean;
    readonly note: string;
  }>;
  readonly vix: number | null;
  readonly spot: number | null;
  readonly symbol: "NIFTY" | "BANKNIFTY";
  readonly generatedAt: string;
  readonly marketOpen: boolean;
  readonly dataFreshnessSec?: number | null;
}

/** Optional inputs. Missing values are surfaced honestly, never fabricated. */
export interface GtiOptionalInput {
  readonly goldSilverRatio?: number | null;
  readonly globalCompositeBiasPct?: number | null; // -1..+1
  readonly astroNote?: string | null;
  readonly gannNote?: string | null;
  readonly gtiNote?: string | null;
  readonly previous?: { readonly action: GtiAction; readonly generatedAt: string } | null;
}

export interface GtiAiDecisionInput {
  readonly decision: GtiDecisionInput;
  readonly institutional: GtiInstitutionalInput;
  readonly optional?: GtiOptionalInput;
}

export interface GtiAiDecision {
  readonly action: GtiAction;
  readonly confidence: number; // 0..100
  readonly confidenceBand: ConfidenceBand;
  readonly tradeQuality: TradeQuality;
  readonly reasons: readonly GtiReason[];
  readonly risk: GtiRiskPlan;
  readonly timeline: GtiTimeline;
  readonly institutionalScore: number;
  readonly warnings: readonly string[];
  readonly generatedAt: string;
  readonly disclaimer: string;
}

export const GTI_AI_DECISION_DISCLAIMER =
  "GTI AI Decision — deterministic orchestration of already-validated EagleBABA engines. Educational only, not investment advice.";