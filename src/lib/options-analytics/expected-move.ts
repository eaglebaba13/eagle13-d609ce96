// Expected move = spot · atmIV · sqrt(daysToExpiry / 365).
import type { OptionChainSnapshot } from "@/lib/option-chain/types";
import type { ExpectedMoveSummary } from "./types";

export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 86400000);
}

export function atmIvOf(snapshot: OptionChainSnapshot): number | null {
  const spot = snapshot.spotPrice;
  if (spot == null) return null;
  let best: number | null = null;
  let bd = Infinity;
  for (const s of snapshot.strikes) {
    const d = Math.abs(s.strike - spot);
    if (d < bd) {
      const iv = s.call.iv ?? s.put.iv ?? null;
      if (iv != null && Number.isFinite(iv)) { best = iv; bd = d; }
    }
  }
  return best;
}

export function computeExpectedMove(snapshot: OptionChainSnapshot, now: Date = new Date()): ExpectedMoveSummary {
  const spot = snapshot.spotPrice;
  const iv = atmIvOf(snapshot);
  let dte: number | null = null;
  if (snapshot.expiry) {
    const d = new Date(`${snapshot.expiry}T15:30:00+05:30`);
    if (!Number.isNaN(d.getTime())) dte = daysBetween(now, d);
  }
  if (spot == null || iv == null || dte == null) {
    return { atmIv: iv, daysToExpiry: dte, upperBand: null, lowerBand: null, expectedRange: null, availability: "UNAVAILABLE" };
  }
  const ivFrac = iv > 5 ? iv / 100 : iv;
  const move = spot * ivFrac * Math.sqrt(dte / 365);
  return { atmIv: iv, daysToExpiry: dte, upperBand: spot + move, lowerBand: spot - move, expectedRange: move * 2, availability: "OK" };
}