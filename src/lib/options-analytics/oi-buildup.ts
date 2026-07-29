// Deterministic OI Build-up classification per leg (research only).
// Snapshot has no LTP change — with only ΔOI we mark the writer/covering
// side and leave direction-dependent classes NEUTRAL to avoid fabrication.

import type { OptionChainSnapshot } from "@/lib/option-chain/types";
import type { OiBuildupClass, OiBuildupRow, OiBuildupSummary } from "./types";

export function classifyLeg(
  changeOi: number | null,
  priceChange: number | null,
): OiBuildupClass {
  if (changeOi == null || !Number.isFinite(changeOi)) return "UNAVAILABLE";
  if (priceChange == null || !Number.isFinite(priceChange)) {
    if (changeOi > 0) return "SHORT_BUILDUP";
    if (changeOi < 0) return "SHORT_COVERING";
    return "NEUTRAL";
  }
  const oiUp = changeOi > 0;
  const pUp = priceChange > 0;
  if (oiUp && pUp) return "LONG_BUILDUP";
  if (oiUp && !pUp) return "SHORT_BUILDUP";
  if (!oiUp && pUp) return "SHORT_COVERING";
  if (!oiUp && !pUp) return "LONG_UNWINDING";
  return "NEUTRAL";
}

export function computeOiBuildup(snapshot: OptionChainSnapshot): OiBuildupSummary {
  const rows: OiBuildupRow[] = [];
  const counts: Record<OiBuildupClass, number> = {
    LONG_BUILDUP: 0, SHORT_BUILDUP: 0, LONG_UNWINDING: 0, SHORT_COVERING: 0, NEUTRAL: 0, UNAVAILABLE: 0,
  };
  let anyData = false;
  for (const s of snapshot.strikes) {
    const legs: ReadonlyArray<["CALL" | "PUT", typeof s.call]> = [["CALL", s.call], ["PUT", s.put]];
    for (const [side, leg] of legs) {
      const klass = classifyLeg(leg.changeOi, null);
      if (leg.changeOi != null) anyData = true;
      counts[klass]++;
      rows.push({ strike: s.strike, side, oi: leg.oi, changeOi: leg.changeOi, ltp: leg.ltp, classification: klass });
    }
  }
  const dominant = (Object.entries(counts) as [OiBuildupClass, number][])
    .filter(([k]) => k !== "UNAVAILABLE" && k !== "NEUTRAL")
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "NEUTRAL";
  const availability = !anyData ? "UNAVAILABLE" : (counts.UNAVAILABLE > 0 ? "PARTIAL" : "OK");
  return { rows, dominant, availability };
}