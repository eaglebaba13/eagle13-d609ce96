// Phase 50 — Server aggregator for the GTI AI Decision.
// Consumes the existing Decision Intelligence Engine + Institutional
// Intelligence layer only. Never recomputes upstream analytics.

import { createServerFn } from "@tanstack/react-start";
import { getDecisionSnapshot } from "@/lib/decision.functions";
import { getInstitutionalIntelligenceSnapshot } from "@/lib/institutional-intelligence/institutional-intelligence.functions";
import { getMarketData } from "@/lib/market.functions";
import { computeGtiAiDecision } from "./engine";
import { formatGtiDecisionForTelegram } from "./telegram";
import type { GtiAiDecision, GtiDecisionInput, GtiInstitutionalInput } from "./types";

export interface GtiAiDecisionSnapshot {
  readonly decision: GtiAiDecision;
  readonly telegramMessage: string;
  readonly upstream: {
    readonly decisionGeneratedAt: string;
    readonly institutionalGeneratedAt: string;
    readonly symbol: "NIFTY" | "BANKNIFTY";
    readonly spot: number | null;
    readonly vix: number | null;
    readonly marketOpen: boolean;
  };
  readonly generatedAt: string;
}

// Module-scope memory of the last delivered action so the "Decision Changed"
// timeline is meaningful across polling. Best-effort; never persisted.
let lastDelivered: { action: GtiAiDecision["action"]; generatedAt: string } | null = null;

export const getGtiAiDecisionSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<GtiAiDecisionSnapshot> => {
    const [decSnap, instSnap, mkt] = await Promise.all([
      getDecisionSnapshot(),
      getInstitutionalIntelligenceSnapshot().catch(() => null),
      getMarketData().catch(() => null),
    ]);

    const symbol = decSnap.context.symbol;
    const spot =
      symbol === "NIFTY"
        ? (decSnap.context.nifty ?? mkt?.nifty?.livePrice ?? null)
        : (decSnap.context.banknifty ?? mkt?.banknifty?.livePrice ?? null);

    const fetchedAt = decSnap.liveOptionChain?.fetchedAt ?? null;
    const freshnessSec = fetchedAt
      ? Math.max(0, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000))
      : null;

    const decisionInput: GtiDecisionInput = {
      action: decSnap.decision.action,
      confidence: decSnap.decision.confidence,
      riskLevel: decSnap.decision.risk.level,
      contributions: decSnap.decision.contributions.map((c) => ({
        key: c.key,
        label: c.label,
        bias: c.bias === "BULL" ? "BULL" : c.bias === "BEAR" ? "BEAR" : "NEUTRAL",
        present: c.present,
        note: c.note,
      })),
      vix: decSnap.context.vix,
      spot,
      symbol,
      generatedAt: decSnap.generatedAt,
      marketOpen: decSnap.context.marketOpen,
      dataFreshnessSec: freshnessSec,
    };

    const institutional: GtiInstitutionalInput = instSnap
      ? {
          score: instSnap.score.score,
          bias: instSnap.score.bias,
          confidence: instSnap.score.confidence,
          available: instSnap.overallStatus === "LIVE" || instSnap.overallStatus === "RESEARCH",
          note: instSnap.score.explanation,
        }
      : { score: 50, bias: "NEUTRAL", confidence: 0, available: false };

    const goldSilverRatio =
      mkt?.gold?.livePrice && mkt?.silver?.livePrice
        ? mkt.gold.livePrice / mkt.silver.livePrice
        : null;

    const decision = computeGtiAiDecision({
      decision: decisionInput,
      institutional,
      optional: {
        goldSilverRatio,
        previous: lastDelivered,
      },
    });

    lastDelivered = { action: decision.action, generatedAt: decision.generatedAt };

    return {
      decision,
      telegramMessage: formatGtiDecisionForTelegram(decision),
      upstream: {
        decisionGeneratedAt: decSnap.generatedAt,
        institutionalGeneratedAt: instSnap?.generatedAt ?? "",
        symbol,
        spot,
        vix: decSnap.context.vix,
        marketOpen: decSnap.context.marketOpen,
      },
      generatedAt: decision.generatedAt,
    };
  },
);