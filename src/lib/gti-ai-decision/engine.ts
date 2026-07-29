// Phase 50 — GTI AI Decision Engine (pure orchestration).
//
// Pure function. No I/O. No provider access. Consumes already-computed
// outputs from the Decision Intelligence Engine and Institutional
// Intelligence layer and reduces them to a single BUY_CALL / BUY_PUT /
// WAIT recommendation with confidence, quality, reasons, and a risk plan.

import {
  GTI_AI_DECISION_DISCLAIMER,
  type ConfidenceBand,
  type GtiAction,
  type GtiAiDecision,
  type GtiAiDecisionInput,
  type GtiDecisionInput,
  type GtiInstitutionalInput,
  type GtiOptionalInput,
  type GtiReason,
  type GtiRiskLevel,
  type GtiRiskPlan,
  type GtiTimeline,
  type ReasonPolarity,
  type TradeQuality,
} from "./types";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
function round(x: number, digits = 0): number {
  const m = 10 ** digits;
  return Math.round(x * m) / m;
}

function mapDecisionAction(a: GtiDecisionInput["action"]): GtiAction {
  if (a === "STRONG_BUY_CE" || a === "BUY_CE") return "BUY_CALL";
  if (a === "STRONG_BUY_PE" || a === "BUY_PE") return "BUY_PUT";
  return "WAIT";
}

function biasDirection(bias: GtiInstitutionalInput["bias"]): 1 | 0 | -1 {
  if (bias === "STRONG_BULLISH" || bias === "BULLISH") return 1;
  if (bias === "STRONG_BEARISH" || bias === "BEARISH") return -1;
  return 0;
}

function actionDirection(a: GtiAction): 1 | 0 | -1 {
  if (a === "BUY_CALL") return 1;
  if (a === "BUY_PUT") return -1;
  return 0;
}

function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 90) return "VERY_HIGH";
  if (confidence >= 75) return "HIGH";
  if (confidence >= 60) return "MEDIUM";
  return "LOW";
}

function riskFor(dec: GtiDecisionInput): GtiRiskLevel {
  const vix = dec.vix ?? null;
  const highVix = vix != null && vix >= 20;
  const veryHighVix = vix != null && vix >= 25;
  if (veryHighVix || dec.riskLevel === "VERY_HIGH") return "HIGH";
  if (highVix || dec.riskLevel === "HIGH") return "HIGH";
  if (dec.riskLevel === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function buildRiskPlan(
  dec: GtiDecisionInput,
  action: GtiAction,
  level: GtiRiskLevel,
): GtiRiskPlan {
  const notes: string[] = [];
  if (dec.vix != null) notes.push(`VIX ${dec.vix.toFixed(2)}`);
  notes.push(`Underlying risk ${dec.riskLevel.replace("_", " ")}`);

  if (action === "WAIT") {
    return {
      level,
      entryZone: null,
      stopLoss: null,
      target1: null,
      target2: null,
      unit: null,
      unavailableReason: "No directional trade — engine on WAIT.",
      notes,
    };
  }
  const spot = dec.spot;
  if (spot == null || !Number.isFinite(spot) || spot <= 0) {
    return {
      level,
      entryZone: null,
      stopLoss: null,
      target1: null,
      target2: null,
      unit: null,
      unavailableReason: `Spot price unavailable for ${dec.symbol} — cannot compute risk plan.`,
      notes,
    };
  }
  // VIX-scaled risk envelopes on the underlying spot.
  // Bounded so an unknown VIX or extreme VIX cannot escape sane multiples.
  const vixScale = clamp((dec.vix ?? 15) / 15, 0.6, 2.0);
  const entryPct = 0.0010 * vixScale;
  const slPct = 0.0035 * vixScale;
  const t1Pct = 0.0060 * vixScale;
  const t2Pct = 0.0110 * vixScale;
  const dir = actionDirection(action);
  const low = round(spot * (1 - entryPct), 2);
  const high = round(spot * (1 + entryPct), 2);
  const stopLoss = round(spot * (1 - dir * slPct), 2);
  const target1 = round(spot * (1 + dir * t1Pct), 2);
  const target2 = round(spot * (1 + dir * t2Pct), 2);
  return {
    level,
    entryZone: { low, high },
    stopLoss,
    target1,
    target2,
    unit: "INDEX_POINTS",
    unavailableReason: null,
    notes,
  };
}

function contributionReasons(
  dec: GtiDecisionInput,
  target: 1 | 0 | -1,
): GtiReason[] {
  if (target === 0) return [];
  const wantBias = target === 1 ? "BULL" : "BEAR";
  return dec.contributions
    .filter((c) => c.present && c.bias === wantBias)
    .map((c) => ({
      key: `dec.${c.key}`,
      label: c.label,
      polarity: (c.bias === "BULL" ? "BULL" : "BEAR") as ReasonPolarity,
      detail: c.note,
    }));
}

function institutionalReason(inst: GtiInstitutionalInput, target: 1 | 0 | -1): GtiReason | null {
  if (!inst.available) return null;
  const dir = biasDirection(inst.bias);
  const aligned = dir !== 0 && dir === target;
  if (!aligned) return null;
  const polarity: ReasonPolarity = dir === 1 ? "BULL" : "BEAR";
  return {
    key: "inst.score",
    label: "Institutional Intelligence",
    polarity,
    detail: `${inst.bias.replace("_", " ")} at ${Math.round(inst.score)}/100`,
  };
}

function optionalReasons(opt: GtiOptionalInput | undefined, target: 1 | 0 | -1): GtiReason[] {
  const out: GtiReason[] = [];
  if (!opt) return out;
  if (opt.astroNote) {
    out.push({ key: "opt.astro", label: "Astro", polarity: "NEUTRAL", detail: opt.astroNote });
  }
  if (opt.gannNote) {
    out.push({ key: "opt.gann", label: "Gann", polarity: "NEUTRAL", detail: opt.gannNote });
  }
  if (opt.gtiNote) {
    out.push({ key: "opt.gti", label: "GTI", polarity: "NEUTRAL", detail: opt.gtiNote });
  }
  if (opt.goldSilverRatio != null && Number.isFinite(opt.goldSilverRatio)) {
    out.push({
      key: "opt.gsr",
      label: "Gold/Silver Ratio",
      polarity: "NEUTRAL",
      detail: `Ratio ${opt.goldSilverRatio.toFixed(2)}`,
    });
  }
  if (opt.globalCompositeBiasPct != null && target !== 0) {
    const g = clamp(opt.globalCompositeBiasPct, -1, 1);
    const dir = g > 0.1 ? 1 : g < -0.1 ? -1 : 0;
    if (dir === target) {
      out.push({
        key: "opt.global",
        label: "Global Market Bias",
        polarity: (dir === 1 ? "BULL" : "BEAR") as ReasonPolarity,
        detail: `${(g * 100).toFixed(0)}% composite`,
      });
    }
  }
  return out;
}

function tradeQualityFor(
  action: GtiAction,
  confidence: number,
  risk: GtiRiskLevel,
  aligned: boolean,
): TradeQuality {
  if (action === "WAIT") return "AVOID";
  if (confidence >= 85 && aligned && risk !== "HIGH") return "EXCELLENT";
  if (confidence >= 70 && risk !== "HIGH") return "GOOD";
  if (confidence >= 55) return "AVERAGE";
  return "AVOID";
}

function buildTimeline(
  dec: GtiDecisionInput,
  current: GtiAction,
  opt: GtiOptionalInput | undefined,
  nowIso: string,
): GtiTimeline {
  const previousAction = opt?.previous?.action ?? null;
  const previousGeneratedAt = opt?.previous?.generatedAt ?? null;
  const decisionChanged = previousAction !== null && previousAction !== current;
  const freshness = dec.dataFreshnessSec ?? null;
  return {
    previousAction,
    previousGeneratedAt,
    currentAction: current,
    currentGeneratedAt: nowIso,
    decisionChanged,
    dataFreshnessSec: freshness,
  };
}

export function computeGtiAiDecision(input: GtiAiDecisionInput): GtiAiDecision {
  const dec = input.decision;
  const inst = input.institutional;
  const opt = input.optional;
  const nowIso = new Date().toISOString();

  // 1) Base action from Decision Engine
  let action: GtiAction = mapDecisionAction(dec.action);

  // 2) Institutional cross-check — a hard directional conflict downgrades to WAIT.
  const warnings: string[] = [];
  const instDir = inst.available ? biasDirection(inst.bias) : 0;
  const actDir = actionDirection(action);
  const aligned = instDir !== 0 && actDir !== 0 && instDir === actDir;
  const hardOpposed =
    inst.available &&
    actDir !== 0 &&
    instDir !== 0 &&
    instDir !== actDir &&
    (inst.bias === "STRONG_BULLISH" || inst.bias === "STRONG_BEARISH");
  if (hardOpposed) {
    warnings.push(
      `Institutional bias (${inst.bias.replace("_", " ")}) opposes ${action.replace("_", " ")} — downgraded to WAIT.`,
    );
    action = "WAIT";
  }

  // 3) Confidence — blend decision confidence with institutional agreement.
  //    Decision engine already accounts for module coverage; institutional
  //    contributes an alignment adjustment weighted by its own coverage.
  const baseConf = clamp(dec.confidence, 0, 100);
  let confidence = baseConf * 0.7;
  if (action === "WAIT") {
    confidence = Math.min(baseConf, 50); // WAIT should not read as high-conviction
  } else if (inst.available) {
    const magnitude = Math.abs(inst.score - 50) / 50; // 0..1
    const alignmentDelta = aligned
      ? +30 * magnitude * inst.confidence
      : instDir === 0
        ? 0
        : -20 * magnitude * inst.confidence;
    confidence = baseConf * 0.7 + 30 * (aligned ? 1 : 0) + alignmentDelta - 30 * (aligned ? 1 : 0);
    // Simpler equivalent, kept explicit for clarity:
    confidence = baseConf * 0.7 + alignmentDelta + (aligned ? 10 : 0);
  } else {
    warnings.push("Institutional Intelligence unavailable — using Decision Engine confidence only.");
  }
  confidence = clamp(round(confidence), 0, 100);

  // 4) Risk plan (index-point levels around underlying spot).
  const riskLevel = riskFor(dec);
  const risk = buildRiskPlan(dec, action, riskLevel);

  // 5) Deterministic reasons — only from present, aligned modules.
  const dirForReasons = actionDirection(action);
  const reasons: GtiReason[] = [
    ...contributionReasons(dec, dirForReasons),
    ...(institutionalReason(inst, dirForReasons) ? [institutionalReason(inst, dirForReasons)!] : []),
    ...optionalReasons(opt, dirForReasons),
  ];
  if (action === "WAIT" && reasons.length === 0) {
    // For WAIT, surface why we are waiting.
    const conflicts = dec.contributions.filter((c) => c.present && c.bias !== "NEUTRAL");
    if (conflicts.length > 0) {
      const bull = conflicts.filter((c) => c.bias === "BULL").length;
      const bear = conflicts.filter((c) => c.bias === "BEAR").length;
      reasons.push({
        key: "wait.mixed",
        label: "Mixed Signals",
        polarity: "NEUTRAL",
        detail: `${bull} bullish vs ${bear} bearish modules — waiting for confirmation.`,
      });
    } else {
      reasons.push({
        key: "wait.insufficient",
        label: "Insufficient Signal",
        polarity: "NEUTRAL",
        detail: "No dominant directional edge in current inputs.",
      });
    }
  }

  // 6) Trade quality
  const tradeQuality = tradeQualityFor(action, confidence, riskLevel, aligned);

  // 7) Warnings for freshness / market status
  if (!dec.marketOpen) warnings.push("Market closed — recommendation reflects last snapshot.");
  if (dec.dataFreshnessSec != null && dec.dataFreshnessSec > 120) {
    warnings.push(`Data older than ${dec.dataFreshnessSec}s — verify before acting.`);
  }

  const timeline = buildTimeline(dec, action, opt, nowIso);

  return {
    action,
    confidence,
    confidenceBand: bandFor(confidence),
    tradeQuality,
    reasons,
    risk,
    timeline,
    institutionalScore: inst.available ? Math.round(inst.score) : 50,
    warnings,
    generatedAt: nowIso,
    disclaimer: GTI_AI_DECISION_DISCLAIMER,
  };
}

export * from "./types";