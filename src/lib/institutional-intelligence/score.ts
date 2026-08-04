// Phase 49 — Deterministic 0..100 Institutional Intelligence Score.
// Composition of already-validated signals. Missing inputs reduce
// confidence but never fabricate a value.

import type { IntelligenceBias, IntelligenceScoreInput, IntelligenceScoreResult } from "./types";

const WEIGHTS: Record<string, number> = {
  weightedBreadthScore: 0.20,
  nifty50BreadthPct: 0.15,
  sectorRotationBias: 0.20,
  fiiDiiBias: 0.15,
  vix: 0.10,
  combinedPcr: 0.10,
  globalCompositeBiasPct: 0.10,
};

function vixSignal(vix: number): number {
  if (vix < 13) return 0.6;
  if (vix < 16) return 0.3;
  if (vix < 20) return 0;
  if (vix < 25) return -0.4;
  return -0.8;
}

function pcrSignal(pcr: number): number {
  // High PCR (>1.1) = puts crowded → contrarian bullish.
  // Low PCR (<0.85) = calls crowded → contrarian bearish.
  const raw = (pcr - 1) * 2; // 0.85 → -0.3, 1.1 → 0.2, 1.3 → 0.6
  return Math.max(-1, Math.min(1, raw));
}

export function classifyBias(score: number): IntelligenceBias {
  if (score >= 75) return "STRONG_BULLISH";
  if (score >= 58) return "BULLISH";
  if (score >= 42) return "NEUTRAL";
  if (score >= 25) return "BEARISH";
  return "STRONG_BEARISH";
}

export function computeIntelligenceScore(input: IntelligenceScoreInput): IntelligenceScoreResult {
  const contributions: { key: string; weight: number; value: number }[] = [];
  const missing: string[] = [];

  const push = (key: string, value: number | null | undefined) => {
    const w = WEIGHTS[key] ?? 0;
    if (value == null || !Number.isFinite(value)) { missing.push(key); return; }
    contributions.push({ key, weight: w, value: Math.max(-1, Math.min(1, value)) });
  };

  push("weightedBreadthScore", input.weightedBreadthScore);
  push("nifty50BreadthPct", input.nifty50BreadthPct == null ? null : input.nifty50BreadthPct / 100);
  push("sectorRotationBias", input.sectorRotationBias);
  push("fiiDiiBias", input.fiiDiiBias);
  push("vix", input.vix == null ? null : vixSignal(input.vix));
  push("combinedPcr", input.combinedPcr == null ? null : pcrSignal(input.combinedPcr));
  push("globalCompositeBiasPct", input.globalCompositeBiasPct);

  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0);
  const weightedAvg = totalWeight === 0
    ? 0
    : contributions.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight;

  const score = Math.round(((weightedAvg + 1) / 2) * 100);
  const bias = classifyBias(score);

  const allWeight = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
  const confidence = Math.round((totalWeight / allWeight) * 100) / 100;

  const parts = contributions.length
    ? contributions.map((c) => `${c.key} ${c.value >= 0 ? "+" : ""}${c.value.toFixed(2)}`).join(" · ")
    : "no signals available";
  const explanation = `${bias} at ${score}/100 (confidence ${(confidence * 100).toFixed(0)}%): ${parts}`;

  return { score, bias, confidence, contributions, missing, explanation };
}