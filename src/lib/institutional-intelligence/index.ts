// Phase 49 — Public surface for the Institutional Intelligence layer.
export * from "./types";
export * from "./top10-registry";
export * from "./sector-registry";
export * from "./weighted-breadth";
export * from "./sector-strength";
export * from "./score";
export * from "./morning-brief";

import type { InstitutionalFlowResult, NewsSentimentResult } from "./types";

/** Flow layer — no validated live FII/DII provider is wired yet. */
export const RESEARCH_FLOW: InstitutionalFlowResult = {
  tradeDate: null,
  fiiNet: null,
  diiNet: null,
  status: "OFFICIAL_SOURCE_REQUIRED",
  reason: "Official NSE / BSE FII-DII feed not connected. Values never fabricated.",
};

/** News layer — no verified sentiment provider is wired yet. */
export const RESEARCH_NEWS: NewsSentimentResult = {
  positive: 0,
  neutral: 0,
  negative: 0,
  marketImpact: "UNAVAILABLE",
  confidence: 0,
  status: "OFFICIAL_SOURCE_REQUIRED",
  reason: "Verified financial-news provider not connected. Headlines never fabricated.",
};