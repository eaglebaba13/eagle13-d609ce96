// Phase 52 — Local alert engine. Pure & deterministic.

import type { AlertKind, LocalAlert } from "./types";

export interface AlertContext {
  readonly aiDecisionAction?: string;
  readonly previousAiDecisionAction?: string;
  readonly institutionalScore?: number;
  readonly previousInstitutionalScore?: number;
  readonly institutionalDelta?: number;
  readonly pcr?: number;
  readonly vix?: number;
}

export interface TriggeredAlert {
  readonly alert: LocalAlert;
  readonly message: string;
}

export function makeAlert(
  id: string,
  kind: AlertKind,
  opts: Partial<LocalAlert> & { message: string },
  now: string = new Date().toISOString(),
): LocalAlert {
  return {
    id,
    kind,
    symbol: opts.symbol,
    threshold: opts.threshold,
    direction: opts.direction,
    createdAt: now,
    triggeredAt: null,
    active: true,
    message: opts.message,
  };
}

export function evaluateAlerts(
  alerts: readonly LocalAlert[],
  ctx: AlertContext,
  now: string = new Date().toISOString(),
): { readonly next: readonly LocalAlert[]; readonly triggered: readonly TriggeredAlert[] } {
  const triggered: TriggeredAlert[] = [];
  const next = alerts.map((a) => {
    if (!a.active) return a;
    let hit = false;
    let msg = a.message;
    switch (a.kind) {
      case "AI_DECISION_CHANGED":
        if (
          ctx.previousAiDecisionAction &&
          ctx.aiDecisionAction &&
          ctx.previousAiDecisionAction !== ctx.aiDecisionAction
        ) {
          hit = true;
          msg = `AI Decision changed: ${ctx.previousAiDecisionAction} → ${ctx.aiDecisionAction}`;
        }
        break;
      case "INSTITUTIONAL_SCORE_CHANGED": {
        const delta =
          ctx.institutionalDelta ??
          (ctx.previousInstitutionalScore != null && ctx.institutionalScore != null
            ? ctx.institutionalScore - ctx.previousInstitutionalScore
            : 0);
        const threshold = a.threshold ?? 10;
        if (Math.abs(delta) >= threshold) {
          hit = true;
          msg = `Institutional Score moved ${delta.toFixed(1)} (≥ ${threshold})`;
        }
        break;
      }
      case "PCR_THRESHOLD":
        if (ctx.pcr != null && a.threshold != null) {
          if (a.direction === "ABOVE" && ctx.pcr >= a.threshold) hit = true;
          if (a.direction === "BELOW" && ctx.pcr <= a.threshold) hit = true;
          if (hit) msg = `PCR ${ctx.pcr.toFixed(2)} crossed ${a.direction} ${a.threshold}`;
        }
        break;
      case "VIX_THRESHOLD":
        if (ctx.vix != null && a.threshold != null) {
          if (a.direction === "ABOVE" && ctx.vix >= a.threshold) hit = true;
          if (a.direction === "BELOW" && ctx.vix <= a.threshold) hit = true;
          if (hit) msg = `VIX ${ctx.vix.toFixed(2)} crossed ${a.direction} ${a.threshold}`;
        }
        break;
      case "STOP_LOSS_HIT":
      case "TARGET_HIT":
        // Manual tracking — engine leaves state unchanged; UI toggles active flag.
        break;
    }
    if (hit) {
      const fired: LocalAlert = { ...a, triggeredAt: now, active: false, message: msg };
      triggered.push({ alert: fired, message: msg });
      return fired;
    }
    return a;
  });
  return { next, triggered };
}