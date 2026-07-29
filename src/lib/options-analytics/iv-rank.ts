import type { Availability } from "./types";

export function computeIvRank(current: number | null, history: readonly number[]): { rank: number | null; availability: Availability; sampleSize: number } {
  const clean = history.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (current == null || !Number.isFinite(current) || clean.length < 2) {
    return { rank: null, availability: "UNAVAILABLE", sampleSize: clean.length };
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (max === min) return { rank: 50, availability: "PARTIAL", sampleSize: clean.length };
  const rank = ((current - min) / (max - min)) * 100;
  return { rank: Math.max(0, Math.min(100, rank)), availability: "OK", sampleSize: clean.length };
}