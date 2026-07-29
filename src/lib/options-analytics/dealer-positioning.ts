import type {
  DealerPositioningSummary,
  GammaExposureSummary,
  DealerPosture,
  HedgingPressure,
  DirectionalBias,
  VolExpectation,
} from "./types";

export function computeDealerPositioning(
  gex: GammaExposureSummary,
  spot: number | null,
): DealerPositioningSummary {
  if (gex.availability === "UNAVAILABLE" || gex.netGamma == null) {
    return {
      posture: "UNAVAILABLE",
      hedgingPressure: "UNAVAILABLE",
      directionalBias: "UNAVAILABLE",
      volatilityExpectation: "UNAVAILABLE",
      netGamma: null,
      availability: "UNAVAILABLE",
    };
  }
  const net = gex.netGamma;
  const posture: DealerPosture = net > 0 ? "LONG_GAMMA" : net < 0 ? "SHORT_GAMMA" : "NEUTRAL";
  const hedgingPressure: HedgingPressure =
    posture === "LONG_GAMMA" ? "SUPPRESSIVE" : posture === "SHORT_GAMMA" ? "AMPLIFYING" : "NEUTRAL";
  const volatilityExpectation: VolExpectation =
    posture === "LONG_GAMMA" ? "LOW" : posture === "SHORT_GAMMA" ? "HIGH" : "NORMAL";
  let directionalBias: DirectionalBias = "NEUTRAL";
  if (gex.gammaFlipStrike != null && spot != null) {
    if (spot > gex.gammaFlipStrike) directionalBias = "BULLISH";
    else if (spot < gex.gammaFlipStrike) directionalBias = "BEARISH";
  }
  return {
    posture,
    hedgingPressure,
    directionalBias,
    volatilityExpectation,
    netGamma: net,
    availability: gex.availability,
  };
}