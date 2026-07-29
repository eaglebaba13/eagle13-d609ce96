import type { Availability } from "./types";

export function computeIvPercentile(current: number | null, history: readonly number[]): { pct: number | null; availability: Availability; sampleSize: number } {
  const clean = history.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (current == null || !Number.isFinite(current) || clean.length < 2) {
    return { pct: null, availability: "UNAVAILABLE", sampleSize: clean.length };
  }
  const below = clean.filter((v) => v <= current).length;
  return { pct: (below / clean.length) * 100, availability: "OK", sampleSize: clean.length };
}