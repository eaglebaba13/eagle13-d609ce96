// Deterministic Gamma Exposure (GEX). If greeks absent -> UNAVAILABLE.
// GEX(K) = (callGamma·callOI - putGamma·putOI) · spot^2 · 0.01

import type { OptionChainSnapshot } from "@/lib/option-chain/types";
import type { GammaExposureSummary } from "./types";

export function computeGammaExposure(snapshot: OptionChainSnapshot): GammaExposureSummary {
  const strikes = snapshot.strikes.slice().sort((a, b) => a.strike - b.strike);
  const anyGamma = strikes.some(
    (s) => s.call.greeks?.gamma != null || s.put.greeks?.gamma != null,
  );
  if (!anyGamma) {
    return {
      totalGamma: null,
      callGamma: null,
      putGamma: null,
      netGamma: null,
      cumulativeGamma: [],
      positiveGammaStrikes: [],
      negativeGammaStrikes: [],
      gammaFlipStrike: null,
      availability: "UNAVAILABLE",
      reason: "Provider did not expose option Greeks",
    };
  }
  const spot = snapshot.spotPrice ?? 0;
  const scale = Math.max(1, spot) * Math.max(1, spot) * 0.01;
  let callGamma = 0;
  let putGamma = 0;
  const perStrike: { strike: number; gex: number }[] = [];
  const pos: number[] = [];
  const neg: number[] = [];
  let missing = false;
  for (const s of strikes) {
    const cg = s.call.greeks?.gamma;
    const pg = s.put.greeks?.gamma;
    const coi = s.call.oi ?? 0;
    const poi = s.put.oi ?? 0;
    if (cg == null && pg == null) { missing = true; continue; }
    if (cg == null || pg == null) missing = true;
    const c = cg != null ? cg * coi * scale : 0;
    const p = pg != null ? pg * poi * scale : 0;
    callGamma += c;
    putGamma += p;
    const gex = c - p;
    perStrike.push({ strike: s.strike, gex });
    if (gex > 0) pos.push(s.strike);
    else if (gex < 0) neg.push(s.strike);
  }
  const cumulative: { strike: number; cum: number }[] = [];
  let cum = 0;
  let flip: number | null = null;
  let prev = 0;
  for (const p of perStrike) {
    prev = cum;
    cum += p.gex;
    cumulative.push({ strike: p.strike, cum });
    if (flip == null && ((prev <= 0 && cum > 0) || (prev >= 0 && cum < 0))) {
      flip = p.strike;
    }
  }
  const net = callGamma - putGamma;
  const availability = missing ? "PARTIAL" : "OK";
  return {
    totalGamma: callGamma + putGamma,
    callGamma,
    putGamma,
    netGamma: net,
    cumulativeGamma: cumulative,
    positiveGammaStrikes: pos,
    negativeGammaStrikes: neg,
    gammaFlipStrike: flip,
    availability,
    reason: availability === "OK" ? "Gamma computed from provider greeks" : "Partial greeks coverage",
  };
}