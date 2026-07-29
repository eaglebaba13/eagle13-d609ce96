// Phase 51 — Deterministic synthetic bar generator for demo & tests.
// Independent utility; does not touch any live provider.
import type { Bar } from "./types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticBars(opts: { seed?: number; bars?: number; start?: number; startPrice?: number } = {}): Bar[] {
  const seed = opts.seed ?? 7;
  const n = opts.bars ?? 250;
  const step = 24 * 60 * 60 * 1000;
  const start = opts.start ?? Date.UTC(2024, 0, 1);
  const rng = mulberry32(seed);
  let price = opts.startPrice ?? 22_000;
  let trend = 0;
  const out: Bar[] = [];
  for (let i = 0; i < n; i++) {
    trend = trend * 0.9 + (rng() - 0.5) * 0.4;
    const drift = trend * price * 0.005;
    const noise = (rng() - 0.5) * price * 0.01;
    const open = price;
    const close = Math.max(1, open + drift + noise);
    const high = Math.max(open, close) + rng() * price * 0.004;
    const low = Math.min(open, close) - rng() * price * 0.004;
    const gti = 50 + trend * 60 + (rng() - 0.5) * 10;
    const vix = 14 + Math.abs(trend) * 10 + rng() * 4;
    const pcr = 0.9 + (rng() - 0.5) * 0.4;
    const inst = 50 + trend * 40 + (rng() - 0.5) * 15;
    const breadth = 50 + trend * 25 + (rng() - 0.5) * 15;
    const sector = trend + (rng() - 0.5) * 0.3;
    const astro = trend * 0.8 + (rng() - 0.5) * 0.3;
    const gann = -trend * 0.6 + (rng() - 0.5) * 0.4;
    const ai = trend > 0.15 ? 1 : trend < -0.15 ? -1 : 0;
    out.push({
      t: start + i * step,
      open, high, low, close,
      indicators: {
        GTI: gti, VIX: vix, PCR: pcr, INSTITUTIONAL_SCORE: inst,
        MARKET_BREADTH: breadth, SECTOR_ROTATION: sector,
        ASTRO_BIAS: astro, GANN_BIAS: gann, AI_DECISION: ai,
        OPTION_CHAIN_PCR: pcr, GOLD_SILVER_RATIO: 80 + (rng() - 0.5) * 4,
      },
    });
    price = close;
  }
  return out;
}