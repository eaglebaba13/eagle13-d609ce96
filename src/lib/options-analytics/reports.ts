import type { OptionsAnalyticsReport } from "./types";

export function toJson(report: OptionsAnalyticsReport): string {
  return JSON.stringify(report, null, 2);
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(report: OptionsAnalyticsReport): string {
  const lines: string[] = ["section,key,value"];
  const push = (section: string, key: string, value: unknown) =>
    lines.push([csvCell(section), csvCell(key), csvCell(value)].join(","));
  push("meta", "generatedAt", report.generatedAt);
  push("meta", "instrument", report.instrument);
  push("meta", "expiry", report.expiry);
  push("meta", "spotPrice", report.spotPrice);
  push("meta", "provider", report.provider);
  push("maxPain", "strike", report.maxPain.strike);
  push("maxPain", "distanceFromSpot", report.maxPain.distanceFromSpot);
  push("maxPain", "confidence", report.maxPain.confidence);
  push("gamma", "totalGamma", report.gammaExposure.totalGamma);
  push("gamma", "netGamma", report.gammaExposure.netGamma);
  push("gamma", "gammaFlipStrike", report.gammaExposure.gammaFlipStrike);
  push("walls", "upperWall", report.gammaWalls.upperWall);
  push("walls", "lowerWall", report.gammaWalls.lowerWall);
  push("walls", "strongestWall", report.gammaWalls.strongestWall);
  push("dealer", "posture", report.dealer.posture);
  push("dealer", "hedgingPressure", report.dealer.hedgingPressure);
  push("dealer", "directionalBias", report.dealer.directionalBias);
  push("dealer", "volatilityExpectation", report.dealer.volatilityExpectation);
  push("iv", "atmIv", report.iv.atmIv);
  push("iv", "ivRank", report.iv.ivRank);
  push("iv", "ivPercentile", report.iv.ivPercentile);
  push("iv", "regime", report.iv.regime);
  push("expectedMove", "upperBand", report.expectedMove.upperBand);
  push("expectedMove", "lowerBand", report.expectedMove.lowerBand);
  push("expectedMove", "expectedRange", report.expectedMove.expectedRange);
  push("marketStructure", "regime", report.marketStructure.regime);
  push("confidence", "score", report.confidence.score);
  for (const l of report.supportResistance.levels) push("supportResistance", `${l.kind}@${l.strike}`, `${l.weight}|${l.sources.join(";")}`);
  for (const r of report.buildup.rows) push("buildup", `${r.side}@${r.strike}`, r.classification);
  return lines.join("\n");
}

export function toPrintable(report: OptionsAnalyticsReport): string {
  const l = (k: string, v: unknown) => `${k.padEnd(28)} ${v ?? "—"}`;
  return [
    `EagleBABA · Options Analytics Report`,
    `Generated: ${report.generatedAt}`,
    `Instrument: ${report.instrument}  Expiry: ${report.expiry ?? "—"}  Spot: ${report.spotPrice ?? "—"}`,
    `Provider: ${report.provider}`,
    ``,
    `MAX PAIN`,
    l("  Strike", report.maxPain.strike),
    l("  Distance from spot", report.maxPain.distanceFromSpot),
    l("  Confidence", report.maxPain.confidence),
    ``,
    `GAMMA EXPOSURE`,
    l("  Total gamma", report.gammaExposure.totalGamma),
    l("  Net gamma", report.gammaExposure.netGamma),
    l("  Flip strike", report.gammaExposure.gammaFlipStrike),
    ``,
    `DEALER POSITIONING`,
    l("  Posture", report.dealer.posture),
    l("  Hedging pressure", report.dealer.hedgingPressure),
    l("  Directional bias", report.dealer.directionalBias),
    l("  Volatility expectation", report.dealer.volatilityExpectation),
    ``,
    `IV ANALYTICS`,
    l("  ATM IV", report.iv.atmIv),
    l("  IV Rank", report.iv.ivRank),
    l("  IV Percentile", report.iv.ivPercentile),
    l("  Regime", report.iv.regime),
    ``,
    `EXPECTED MOVE`,
    l("  Upper band", report.expectedMove.upperBand),
    l("  Lower band", report.expectedMove.lowerBand),
    l("  Expected range", report.expectedMove.expectedRange),
    ``,
    `MARKET STRUCTURE`,
    l("  Regime", report.marketStructure.regime),
    l("  Rationale", report.marketStructure.rationale),
    ``,
    `CONFIDENCE`,
    l("  Score", report.confidence.score),
    l("  Missing", report.confidence.missing.join(", ") || "—"),
  ].join("\n");
}