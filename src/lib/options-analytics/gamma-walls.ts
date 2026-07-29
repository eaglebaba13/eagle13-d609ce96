import type { GammaExposureSummary, GammaWallsSummary } from "./types";

export function computeGammaWalls(
  gex: GammaExposureSummary,
  spot: number | null,
): GammaWallsSummary {
  if (gex.availability === "UNAVAILABLE" || gex.cumulativeGamma.length === 0) {
    return { upperWall: null, lowerWall: null, strongestWall: null, wallStrength: null, availability: "UNAVAILABLE" };
  }
  const perStrike: { strike: number; mag: number }[] = [];
  let prev = 0;
  for (const p of gex.cumulativeGamma) {
    perStrike.push({ strike: p.strike, mag: Math.abs(p.cum - prev) });
    prev = p.cum;
  }
  let upper: number | null = null, upperMag = -1;
  let lower: number | null = null, lowerMag = -1;
  let strongest: number | null = null, strongestMag = -1;
  for (const p of perStrike) {
    if (p.mag > strongestMag) { strongestMag = p.mag; strongest = p.strike; }
    if (spot != null) {
      if (p.strike >= spot && p.mag > upperMag) { upperMag = p.mag; upper = p.strike; }
      if (p.strike <= spot && p.mag > lowerMag) { lowerMag = p.mag; lower = p.strike; }
    }
  }
  return { upperWall: upper, lowerWall: lower, strongestWall: strongest, wallStrength: strongestMag >= 0 ? strongestMag : null, availability: gex.availability };
}