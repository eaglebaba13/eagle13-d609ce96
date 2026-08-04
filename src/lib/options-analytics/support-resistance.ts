import type { OptionChainSnapshot } from "@/lib/option-chain/types";
import type {
  GammaWallsSummary,
  MaxPainSummary,
  DealerPositioningSummary,
  SupportResistanceLevel,
  SupportResistanceSummary,
} from "./types";

export function computeSupportResistance(
  snapshot: OptionChainSnapshot,
  walls: GammaWallsSummary,
  maxPain: MaxPainSummary,
  _dealer: DealerPositioningSummary,
): SupportResistanceSummary {
  const spot = snapshot.spotPrice;
  const bag = new Map<number, { kind: "SUPPORT" | "RESISTANCE"; weight: number; sources: string[] }>();
  const add = (strike: number | null, kind: "SUPPORT" | "RESISTANCE", weight: number, source: string) => {
    if (strike == null) return;
    const prev = bag.get(strike);
    if (prev) {
      prev.weight += weight;
      if (!prev.sources.includes(source)) prev.sources.push(source);
    } else {
      bag.set(strike, { kind, weight, sources: [source] });
    }
  };
  let maxCallOi = 0, maxPutOi = 0;
  let callResistance: number | null = null, putSupport: number | null = null;
  for (const s of snapshot.strikes) {
    if ((s.call.oi ?? 0) > maxCallOi) { maxCallOi = s.call.oi ?? 0; callResistance = s.strike; }
    if ((s.put.oi ?? 0) > maxPutOi) { maxPutOi = s.put.oi ?? 0; putSupport = s.strike; }
  }
  add(callResistance, "RESISTANCE", 2, "call-oi");
  add(putSupport, "SUPPORT", 2, "put-oi");
  if (walls.upperWall != null) add(walls.upperWall, "RESISTANCE", 2, "gamma-wall");
  if (walls.lowerWall != null) add(walls.lowerWall, "SUPPORT", 2, "gamma-wall");
  if (maxPain.strike != null && spot != null) {
    add(maxPain.strike, maxPain.strike >= spot ? "RESISTANCE" : "SUPPORT", 1, "max-pain");
  }
  const levels: SupportResistanceLevel[] = Array.from(bag.entries())
    .map(([strike, v]) => ({ strike, kind: v.kind, weight: v.weight, sources: v.sources }))
    .sort((a, b) => b.weight - a.weight);
  return { levels, availability: levels.length === 0 ? "UNAVAILABLE" : "OK" };
}