// Phase 51 — Built-in strategy library. Pure data.
import type { Strategy } from "./types";

function g(id: string, combinator: "AND" | "OR", conditions: Strategy["entry"]["conditions"]): Strategy["entry"] {
  return { id, combinator, conditions };
}

export const BUILTIN_STRATEGIES: readonly Strategy[] = [
  {
    id: "gti-intraday", name: "GTI Intraday", builtin: true,
    description: "Long CALL when GTI momentum is strong and VIX is contained.",
    entry: g("e", "AND", [
      { id: "c1", indicator: "GTI", op: ">", value: 60 },
      { id: "c2", indicator: "VIX", op: "<", value: 18 },
    ]),
    action: { kind: "BUY_CALL" },
    risk: { targetPct: 1.2, stopPct: 0.6, trailingStopPct: 0.8, maxTrades: 8 },
  },
  {
    id: "gti-swing", name: "GTI Swing", builtin: true,
    description: "Multi-day directional bias using GTI + Institutional Score.",
    entry: g("e", "AND", [
      { id: "c1", indicator: "GTI", op: ">", value: 55 },
      { id: "c2", indicator: "INSTITUTIONAL_SCORE", op: ">=", value: 60 },
    ]),
    action: { kind: "BUY_CALL" },
    risk: { targetPct: 3.5, stopPct: 1.8 },
  },
  {
    id: "astro-trend", name: "Astro Trend", builtin: true,
    description: "Follow astro bias when aligned with market breadth.",
    entry: g("e", "AND", [
      { id: "c1", indicator: "ASTRO_BIAS", op: ">", value: 0.3 },
      { id: "c2", indicator: "MARKET_BREADTH", op: ">", value: 55 },
    ]),
    action: { kind: "BUY_CALL" },
    risk: { targetPct: 2.0, stopPct: 1.0 },
  },
  {
    id: "gann-reversal", name: "Gann Reversal", builtin: true,
    description: "Fade extreme moves when Gann bias flips negative.",
    entry: g("e", "AND", [
      { id: "c1", indicator: "GANN_BIAS", op: "<", value: -0.4 },
      { id: "c2", indicator: "VIX", op: ">", value: 16 },
    ]),
    action: { kind: "BUY_PUT" },
    risk: { targetPct: 1.8, stopPct: 1.0 },
  },
  {
    id: "institutional-momentum", name: "Institutional Momentum", builtin: true,
    description: "Institutional score momentum with sector confirmation.",
    entry: g("e", "AND", [
      { id: "c1", indicator: "INSTITUTIONAL_SCORE", op: ">=", value: 70 },
      { id: "c2", indicator: "SECTOR_ROTATION", op: ">", value: 0.2 },
    ]),
    action: { kind: "BUY_CALL" },
    risk: { targetPct: 2.5, stopPct: 1.2 },
  },
  {
    id: "pcr-breadth", name: "PCR + Breadth", builtin: true,
    description: "Contrarian PCR entry confirmed by breadth thrust.",
    entry: g("e", "AND", [
      { id: "c1", indicator: "PCR", op: "<", value: 0.85 },
      { id: "c2", indicator: "MARKET_BREADTH", op: ">", value: 60 },
    ]),
    action: { kind: "BUY_CALL" },
    risk: { targetPct: 1.5, stopPct: 0.9 },
  },
  {
    id: "ai-confirmation", name: "AI Confirmation", builtin: true,
    description: "Take AI Decision only when GTI and Institutional align.",
    entry: g("e", "AND", [
      { id: "c1", indicator: "AI_DECISION", op: ">=", value: 1 },
      { id: "c2", indicator: "GTI", op: ">", value: 55 },
      { id: "c3", indicator: "INSTITUTIONAL_SCORE", op: ">=", value: 55 },
    ]),
    action: { kind: "BUY_CALL" },
    risk: { targetPct: 2.2, stopPct: 1.1, trailingStopPct: 1.5 },
  },
];