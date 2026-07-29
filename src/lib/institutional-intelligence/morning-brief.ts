// Phase 49 — Morning Brief / Telegram text for the Institutional layer.

import type { InstitutionalIntelligenceSnapshot } from "./types";

export function renderInstitutionalIntelligenceBlock(
  snap: InstitutionalIntelligenceSnapshot,
): string {
  const s = snap.score;
  const wb = snap.weightedBreadth;
  const sec = snap.sectors;
  const flow = snap.flow;
  const news = snap.news;

  const leaders = sec.leaders.length
    ? sec.leaders.map((r) => `${r.label} ${(r.changePct ?? 0).toFixed(2)}%`).join(", ")
    : `${sec.status}${sec.reason ? ` — ${sec.reason}` : ""}`;
  const laggards = sec.laggards.length
    ? sec.laggards.map((r) => `${r.label} ${(r.changePct ?? 0).toFixed(2)}%`).join(", ")
    : `${sec.status}${sec.reason ? ` — ${sec.reason}` : ""}`;

  const breadth = wb.status === "LIVE"
    ? `Positive ${wb.positiveWeightPct}% · Negative ${wb.negativeWeightPct}% · Score ${wb.weightedBreadthScore}`
    : `${wb.status}${wb.reason ? ` — ${wb.reason}` : ""}`;

  const flowLine = flow.status === "LIVE"
    ? `FII ${flow.fiiNet ?? "N/A"} · DII ${flow.diiNet ?? "N/A"} (${flow.tradeDate ?? "—"})`
    : `${flow.status} — ${flow.reason}`;

  const newsLine = news.status === "LIVE"
    ? `+${news.positive} / ~${news.neutral} / -${news.negative} · Impact ${news.marketImpact}`
    : `${news.status} — ${news.reason}`;

  return [
    `Institutional Score: ${s.score}/100 · Bias ${s.bias.replace(/_/g, " ")} · Confidence ${(s.confidence * 100).toFixed(0)}%`,
    `Weighted Breadth: ${breadth}`,
    `Sector Leaders: ${leaders}`,
    `Sector Laggards: ${laggards}`,
    `Institutional Flow: ${flowLine}`,
    `News Sentiment: ${newsLine}`,
  ].join("\n");
}