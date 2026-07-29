// Phase 50 — Deterministic Telegram formatter for the GTI AI Decision.
// Pure function. No I/O. Output stays under Telegram's 4096-char limit.

import type { GtiAiDecision } from "./types";

function actionEmoji(a: GtiAiDecision["action"]): string {
  if (a === "BUY_CALL") return "🟢";
  if (a === "BUY_PUT") return "🔴";
  return "🟡";
}

function actionLabel(a: GtiAiDecision["action"]): string {
  if (a === "BUY_CALL") return "BUY CALL";
  if (a === "BUY_PUT") return "BUY PUT";
  return "WAIT";
}

function qualityLabel(q: GtiAiDecision["tradeQuality"]): string {
  if (q === "EXCELLENT") return "Excellent";
  if (q === "GOOD") return "Good";
  if (q === "AVERAGE") return "Average";
  return "Avoid";
}

function formatHHMM(iso: string): string {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).formatToParts(d);
    const hh = parts.find((p) => p.type === "hour")?.value ?? "--";
    const mm = parts.find((p) => p.type === "minute")?.value ?? "--";
    return `${hh}:${mm} IST`;
  } catch {
    return "-- IST";
  }
}

export function formatGtiDecisionForTelegram(d: GtiAiDecision): string {
  const lines: string[] = [];
  lines.push(`${actionEmoji(d.action)} AI Decision`);
  lines.push("");
  lines.push("Recommendation:");
  lines.push(actionLabel(d.action));
  lines.push("");
  lines.push("Confidence:");
  lines.push(`${Math.round(d.confidence)}% (${d.confidenceBand.replace("_", " ")})`);
  lines.push("");
  lines.push("Trade Quality:");
  lines.push(qualityLabel(d.tradeQuality));
  lines.push("");
  if (d.reasons.length > 0) {
    lines.push("Reasons:");
    for (const r of d.reasons.slice(0, 6)) {
      lines.push(`• ${r.label}: ${r.detail}`);
    }
    lines.push("");
  }
  lines.push("Risk:");
  lines.push(d.risk.level);
  if (d.risk.entryZone) {
    lines.push(`Entry: ${d.risk.entryZone.low} – ${d.risk.entryZone.high}`);
  }
  if (d.risk.stopLoss != null) lines.push(`Stop Loss: ${d.risk.stopLoss}`);
  if (d.risk.target1 != null) lines.push(`Target 1: ${d.risk.target1}`);
  if (d.risk.target2 != null) lines.push(`Target 2: ${d.risk.target2}`);
  if (d.risk.unavailableReason) lines.push(`Note: ${d.risk.unavailableReason}`);
  lines.push("");
  lines.push("Generated:");
  lines.push(formatHHMM(d.generatedAt));
  if (d.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of d.warnings.slice(0, 3)) lines.push(`• ${w}`);
  }
  return lines.join("\n");
}