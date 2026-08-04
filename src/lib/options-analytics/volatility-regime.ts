import type { IvRegime, Availability } from "./types";

export function classifyIvRegime(rank: number | null): { regime: IvRegime; availability: Availability } {
  if (rank == null || !Number.isFinite(rank)) return { regime: "UNAVAILABLE", availability: "UNAVAILABLE" };
  if (rank < 20) return { regime: "LOW", availability: "OK" };
  if (rank < 60) return { regime: "NORMAL", availability: "OK" };
  if (rank < 85) return { regime: "HIGH", availability: "OK" };
  return { regime: "EXTREME", availability: "OK" };
}