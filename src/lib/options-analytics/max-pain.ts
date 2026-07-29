// Deterministic Max Pain (research-only). Independent from institutional-flow;
// we do NOT modify that engine. Formula:
//   pain(K) = Σ callOi(S)·max(K-S,0) + putOi(S)·max(S-K,0).

import type { OptionChainSnapshot } from "@/lib/option-chain/types";
import type { MaxPainSummary } from "./types";

export function computeMaxPain(
  snapshot: OptionChainSnapshot,
  priorMaxPain: number | null = null,
): MaxPainSummary {
  const strikes = snapshot.strikes;
  const anyOi = strikes.some((s) => s.call.oi != null || s.put.oi != null);
  if (!anyOi || strikes.length === 0) {
    return {
      strike: null,
      distanceFromSpot: null,
      distanceFromSpotPct: null,
      dailyChange: null,
      perStrikePain: [],
      confidence: 0,
      availability: strikes.length === 0 ? "UNAVAILABLE" : "PARTIAL",
    };
  }
  const both = strikes.every((s) => s.call.oi != null && s.put.oi != null);
  const perStrikePain = strikes.map((row) => {
    let pain = 0;
    for (const s of strikes) {
      const co = s.call.oi ?? 0;
      const po = s.put.oi ?? 0;
      pain += co * Math.max(row.strike - s.strike, 0);
      pain += po * Math.max(s.strike - row.strike, 0);
    }
    return { strike: row.strike, pain };
  });
  const spot = snapshot.spotPrice;
  const distTo = (k: number) => (spot != null ? Math.abs(k - spot) : 0);
  let minK = perStrikePain[0].strike;
  let minP = perStrikePain[0].pain;
  for (const p of perStrikePain) {
    if (p.pain < minP) { minP = p.pain; minK = p.strike; continue; }
    if (p.pain === minP) {
      const dN = distTo(p.strike);
      const dC = distTo(minK);
      if (dN < dC || (dN === dC && p.strike < minK)) minK = p.strike;
    }
  }
  const distance = spot != null ? minK - spot : null;
  const distancePct = spot != null && spot !== 0 ? ((minK - spot) / spot) * 100 : null;
  const dailyChange = priorMaxPain != null ? minK - priorMaxPain : null;
  const confidence = both ? 100 : Math.round((strikes.filter((s) => s.call.oi != null && s.put.oi != null).length / strikes.length) * 100);
  return {
    strike: minK,
    distanceFromSpot: distance,
    distanceFromSpotPct: distancePct,
    dailyChange,
    perStrikePain,
    confidence,
    availability: both ? "OK" : "PARTIAL",
  };
}