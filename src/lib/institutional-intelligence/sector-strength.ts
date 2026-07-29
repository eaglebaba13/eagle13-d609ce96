// Phase 49 — Sector rotation from live index quotes. Pure function.

import { II_SECTOR_REGISTRY, type SectorIndexDef } from "./sector-registry";
import type { LiveStatus, QuoteSnapshot, SectorRotationResult, SectorStrengthRow } from "./types";

function classify(chg: number | null): SectorStrengthRow["bias"] {
  if (chg == null) return "UNAVAILABLE";
  if (chg >= 0.3) return "BULLISH";
  if (chg <= -0.3) return "BEARISH";
  return "NEUTRAL";
}

function scaleStrength(chg: number | null): number | null {
  if (chg == null) return null;
  // Map -3% .. +3% to 0..100 with 50 = neutral.
  const clamped = Math.max(-3, Math.min(3, chg));
  return Math.round(((clamped + 3) / 6) * 1000) / 10;
}

export function computeSectorRotation(
  quotes: readonly QuoteSnapshot[],
  registry: readonly SectorIndexDef[] = II_SECTOR_REGISTRY,
): SectorRotationResult {
  const rows: SectorStrengthRow[] = registry.map((s) => {
    const q = quotes.find((x) => x.symbol === s.yahooSymbol) ?? null;
    const chg = q?.changePct ?? null;
    return {
      id: s.id,
      label: s.label,
      changePct: chg,
      bias: classify(chg),
      strengthPct: scaleStrength(chg),
    };
  });

  const available = rows.filter((r) => r.changePct != null);
  const bullish = rows.filter((r) => r.bias === "BULLISH").length;
  const bearish = rows.filter((r) => r.bias === "BEARISH").length;
  const neutral = rows.filter((r) => r.bias === "NEUTRAL").length;

  const leaders = [...rows]
    .filter((r) => r.bias === "BULLISH")
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, 3);
  const laggards = [...rows]
    .filter((r) => r.bias === "BEARISH")
    .sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))
    .slice(0, 3);

  const coverage = registry.length ? available.length / registry.length : 0;
  const rotationBias = available.length
    ? Math.max(-1, Math.min(1, (bullish - bearish) / available.length))
    : 0;

  let status: LiveStatus;
  let reason: string | null = null;
  if (coverage >= 0.6) status = "LIVE";
  else if (coverage > 0) { status = "PROVIDER_PENDING"; reason = `Partial coverage: ${(coverage * 100).toFixed(0)}%`; }
  else { status = "PROVIDER_PENDING"; reason = "No sector index quotes available"; }

  return {
    rows, leaders, laggards,
    bullishCount: bullish,
    neutralCount: neutral,
    bearishCount: bearish,
    rotationBias: Math.round(rotationBias * 100) / 100,
    coverage: Math.round(coverage * 100) / 100,
    status, reason,
  };
}