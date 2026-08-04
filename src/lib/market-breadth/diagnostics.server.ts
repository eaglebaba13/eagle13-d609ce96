// Phase 27 Stage 3 - Admin diagnostics report for market breadth.
// Phase 69 adds production-safe provider-backed coverage diagnostics.

import { evaluateVixRegime } from "./vix-regime";
import { adaptPcrConfirmation } from "./pcr-confirmation";
import { classifyGti } from "./gti-classifier";
import { NIFTY50_REGISTRY_VERSION, NIFTY50_REGISTRY_EFFECTIVE_DATE } from "./nifty50-registry";
import { SECTOR_REGISTRY_VERSION, SECTOR_REGISTRY_EFFECTIVE_DATE } from "./sector-registry";
import { buildProviderBackedBreadthBundle } from "./provider-backed.server";
import { PRODUCTION_NIFTY50_REGISTRY_VERSION, validateProductionNifty50Registry } from "./production-registry";
import type { ConfidenceBreakdown } from "./types";

export interface MarketBreadthDiagnosticsReport {
  readonly generatedAt: string;
  readonly provider: string;
  readonly universeRequested: number;
  readonly universeReturned: number;
  readonly coverage: number;
  readonly advances: number;
  readonly declines: number;
  readonly unchanged: number;
  readonly unavailable: number;
  readonly nifty50RegistryVersion: string;
  readonly nifty50RegistryEffectiveDate: string;
  readonly sectorRegistryVersion: string;
  readonly sectorRegistryEffectiveDate: string;
  readonly weightRegistryVersion: string;
  readonly freshness: "FRESH" | "STALE" | "UNKNOWN";
  readonly latencyMs: number;
  readonly partialData: boolean;
  readonly lastError: string | null;
  readonly constituentRegistryStatus: "READY" | "DEGRADED";
  readonly registryVerified: boolean;
  readonly expectedConstituents: number;
  readonly validConstituents: number;
  readonly missingConstituents: number;
  readonly staleConstituents: number;
  readonly duplicateConstituents: number;
  readonly coveragePct: number;
  readonly top10CoveragePct: number;
  readonly sectorCoverage: number;
  readonly providerStatus: "LIVE" | "PARTIAL" | "STALE" | "MARKET_CLOSED" | "UNAVAILABLE";
  readonly marketSession: string;
  readonly breadthPersistence: "CLIENT_HISTORY_ONLY";
  readonly lastSuccessfulLoad: string | null;
  readonly productionBreadthReady: boolean;
  readonly sourceFreshness: "FRESH" | "STALE" | "UNKNOWN";
  readonly gti: {
    readonly inputReadiness: number;
    readonly pcrReadiness: boolean;
    readonly vixReadiness: boolean;
    readonly sectorReadiness: number;
    readonly conflictCodes: readonly string[];
    readonly confidenceBreakdown: ConfidenceBreakdown;
    readonly finalResearchState: string;
  };
}

function pct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 10;
}

function safeError(warnings: readonly string[]): string | null {
  const first = warnings[0];
  if (!first) return null;
  return first.replace(/token|secret|authorization|cookie|api[-_]?key|bearer/gi, "[REDACTED]").slice(0, 160);
}

export async function buildMarketBreadthDiagnostics(): Promise<MarketBreadthDiagnosticsReport> {
  const t0 = Date.now();
  const bundle = await buildProviderBackedBreadthBundle();
  const validation = validateProductionNifty50Registry();
  const vix = evaluateVixRegime({ currentVix: null, previousVix: null, provider: "N/A", timestamp: new Date().toISOString() });
  const pcr = adaptPcrConfirmation({ reading: null });
  const gti = classifyGti({
    broad: bundle.broad,
    nifty50: bundle.nifty50,
    topWeighted: bundle.topWeighted,
    banking: bundle.banking,
    it: bundle.it,
    oilGas: bundle.oilGas,
    auto: bundle.auto,
    pcr,
    vix,
    runId: `gti-diag-${Date.now().toString(36)}`,
  });
  const b = bundle.nifty50;
  const sectors = [bundle.banking, bundle.it, bundle.oilGas, bundle.auto];
  const sectorReadiness = sectors.filter((s) => s && s.dataQuality !== "FAILED").length / sectors.length;
  const top10Coverage = bundle.topWeighted?.constituentCoverage ?? 0;
  const coverage = b?.constituentCoverage ?? 0;
  const productionReady = validation.verified && bundle.summary.status === "LIVE" && coverage >= 0.8 && b?.freshness === "FRESH" && b.dataQuality === "OK";

  return {
    generatedAt: new Date().toISOString(),
    provider: bundle.summary.provider,
    universeRequested: bundle.summary.attempted,
    universeReturned: bundle.summary.valid,
    coverage,
    advances: b?.advances ?? 0,
    declines: b?.declines ?? 0,
    unchanged: b?.unchanged ?? 0,
    unavailable: b?.unavailable ?? bundle.summary.unavailable,
    nifty50RegistryVersion: NIFTY50_REGISTRY_VERSION,
    nifty50RegistryEffectiveDate: NIFTY50_REGISTRY_EFFECTIVE_DATE,
    sectorRegistryVersion: SECTOR_REGISTRY_VERSION,
    sectorRegistryEffectiveDate: SECTOR_REGISTRY_EFFECTIVE_DATE,
    weightRegistryVersion: PRODUCTION_NIFTY50_REGISTRY_VERSION,
    freshness: b?.freshness ?? "UNKNOWN",
    latencyMs: Date.now() - t0,
    partialData: bundle.summary.status === "PARTIAL" || b?.dataQuality === "PARTIAL",
    lastError: safeError(bundle.summary.safeWarnings),
    constituentRegistryStatus: validation.verified ? "READY" : "DEGRADED",
    registryVerified: validation.verified,
    expectedConstituents: validation.totalExpected,
    validConstituents: bundle.summary.valid,
    missingConstituents: bundle.summary.unavailable,
    staleConstituents: bundle.summary.stale,
    duplicateConstituents: validation.duplicateSymbols.length,
    coveragePct: pct(coverage),
    top10CoveragePct: pct(top10Coverage),
    sectorCoverage: pct(sectorReadiness),
    providerStatus: bundle.summary.status,
    marketSession: bundle.summary.marketSession.state,
    breadthPersistence: "CLIENT_HISTORY_ONLY",
    lastSuccessfulLoad: bundle.summary.valid > 0 ? bundle.summary.observedAt : null,
    productionBreadthReady: productionReady,
    sourceFreshness: b?.freshness ?? "UNKNOWN",
    gti: {
      inputReadiness: [bundle.broad, bundle.nifty50, bundle.topWeighted, ...sectors].filter((s) => s && s.dataQuality !== "FAILED").length / 7,
      pcrReadiness: pcr.available,
      vixReadiness: vix.regime !== "UNKNOWN",
      sectorReadiness,
      conflictCodes: gti.conflicts.map((c) => c.code),
      confidenceBreakdown: gti.confidenceBreakdown,
      finalResearchState: gti.state,
    },
  };
}
