import type { OptionChainSnapshot } from "@/lib/option-chain/types";
import type { ConfidenceSummary, GammaExposureSummary, IvAnalyticsSummary } from "./types";

export function computeConfidence(
  snapshot: OptionChainSnapshot,
  gex: GammaExposureSummary,
  iv: IvAnalyticsSummary,
): ConfidenceSummary {
  const missing: string[] = [];
  const strikes = snapshot.strikes;
  const total = strikes.length;
  const withBothOi = total === 0 ? 0 : strikes.filter((s) => s.call.oi != null && s.put.oi != null).length;
  const withAnyIv = total === 0 ? 0 : strikes.filter((s) => s.call.iv != null || s.put.iv != null).length;
  const providerQuality = snapshot.dataQuality === "OK" ? 100 : snapshot.dataQuality === "PARTIAL" ? 60 : snapshot.dataQuality === "STALE" ? 40 : 0;
  const chainCompleteness = total === 0 ? 0 : Math.round((withBothOi / total) * 100);
  const ivAvailability = total === 0 ? 0 : Math.round((withAnyIv / total) * 100);
  const oiQuality = chainCompleteness;
  const gammaCompleteness = gex.availability === "OK" ? 100 : gex.availability === "PARTIAL" ? 50 : 0;
  const expiryValidity = snapshot.expiry ? 100 : 0;
  if (providerQuality < 100) missing.push("provider-quality");
  if (chainCompleteness < 100) missing.push("oi-coverage");
  if (ivAvailability < 50) missing.push("iv-coverage");
  if (gammaCompleteness === 0) missing.push("gamma-greeks");
  if (!snapshot.expiry) missing.push("expiry");
  if (iv.availability === "UNAVAILABLE") missing.push("iv-history");
  const breakdown = { providerQuality, chainCompleteness, ivAvailability, oiQuality, gammaCompleteness, expiryValidity };
  const score = Math.round(
    providerQuality * 0.25 +
    chainCompleteness * 0.2 +
    oiQuality * 0.15 +
    ivAvailability * 0.15 +
    gammaCompleteness * 0.15 +
    expiryValidity * 0.1,
  );
  return { score: Math.max(0, Math.min(100, score)), breakdown, missing };
}