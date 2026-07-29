import type {
  MarketStructureSummary,
  ExpectedMoveSummary,
  DealerPositioningSummary,
  IvAnalyticsSummary,
} from "./types";

export function computeMarketStructure(
  em: ExpectedMoveSummary,
  dealer: DealerPositioningSummary,
  iv: IvAnalyticsSummary,
): MarketStructureSummary {
  if (em.availability === "UNAVAILABLE" && dealer.availability === "UNAVAILABLE" && iv.availability === "UNAVAILABLE") {
    return { regime: "UNAVAILABLE", rationale: "Insufficient inputs", availability: "UNAVAILABLE" };
  }
  if (iv.regime === "EXTREME") return { regime: "HIGH_VOLATILITY", rationale: "IV Rank is extreme", availability: "OK" };
  if (dealer.posture === "SHORT_GAMMA") return { regime: "EXPANSION", rationale: "Dealers short gamma amplify moves", availability: "OK" };
  if (dealer.posture === "LONG_GAMMA" && iv.regime === "LOW") return { regime: "COMPRESSION", rationale: "Dealers long gamma suppress moves in low IV", availability: "OK" };
  if (dealer.directionalBias === "BULLISH" || dealer.directionalBias === "BEARISH") return { regime: "TRENDING", rationale: `Directional bias ${dealer.directionalBias}`, availability: "OK" };
  return { regime: "BALANCED", rationale: "No dominant regime signal", availability: "PARTIAL" };
}