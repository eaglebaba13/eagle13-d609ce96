import { NIFTY50_CONSTITUENTS, NIFTY50_REGISTRY_EFFECTIVE_DATE, NIFTY50_REGISTRY_SOURCE, NIFTY50_REGISTRY_VERSION } from "./nifty50-registry";

export const PRODUCTION_NIFTY50_REGISTRY_VERSION = `${NIFTY50_REGISTRY_VERSION}+production-metadata`;
export const PRODUCTION_NIFTY50_PROVIDER_ALIAS = "YAHOO_FINANCE_CHART";

export type ConstituentStatus = "ACTIVE" | "UNKNOWN";

export interface ProductionNifty50Constituent {
  readonly symbol: string;
  readonly exchange: "NSE";
  readonly instrumentKey: string;
  readonly index: "NIFTY50";
  readonly sector: string;
  readonly weight: number;
  readonly effectiveFrom: string;
  readonly source: string;
  readonly verified: boolean;
  readonly status: ConstituentStatus;
}

function yahooSymbol(symbol: string): string {
  return symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;
}

export const PRODUCTION_NIFTY50_CONSTITUENTS: readonly ProductionNifty50Constituent[] = Object.freeze(
  NIFTY50_CONSTITUENTS.map((c) => Object.freeze({
    symbol: c.symbol,
    exchange: "NSE" as const,
    instrumentKey: yahooSymbol(c.symbol),
    index: "NIFTY50" as const,
    sector: c.sector,
    weight: c.weight,
    effectiveFrom: NIFTY50_REGISTRY_EFFECTIVE_DATE,
    source: NIFTY50_REGISTRY_SOURCE,
    verified: true,
    status: "ACTIVE" as const,
  })),
);

export interface RegistryValidationResult {
  readonly duplicateSymbols: readonly string[];
  readonly missingFields: readonly string[];
  readonly invalidWeights: readonly string[];
  readonly verified: boolean;
  readonly totalExpected: number;
}

export function yahooSymbolForNifty50(symbol: string): string {
  return yahooSymbol(symbol);
}

export function validateProductionNifty50Registry(
  constituents: readonly ProductionNifty50Constituent[] = PRODUCTION_NIFTY50_CONSTITUENTS,
): RegistryValidationResult {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const missingFields: string[] = [];
  const invalidWeights: string[] = [];

  for (const c of constituents) {
    if (seen.has(c.symbol)) duplicates.add(c.symbol);
    seen.add(c.symbol);
    if (!c.exchange) missingFields.push(`${c.symbol}.exchange`);
    if (!c.instrumentKey) missingFields.push(`${c.symbol}.instrumentKey`);
    if (!c.index) missingFields.push(`${c.symbol}.index`);
    if (!c.sector) missingFields.push(`${c.symbol}.sector`);
    if (!c.effectiveFrom) missingFields.push(`${c.symbol}.effectiveFrom`);
    if (!c.source) missingFields.push(`${c.symbol}.source`);
    if (!Number.isFinite(c.weight) || c.weight <= 0) invalidWeights.push(c.symbol);
  }

  return Object.freeze({
    duplicateSymbols: Object.freeze([...duplicates].sort()),
    missingFields: Object.freeze(missingFields.sort()),
    invalidWeights: Object.freeze(invalidWeights.sort()),
    verified:
      constituents.length === 50 &&
      duplicates.size === 0 &&
      missingFields.length === 0 &&
      invalidWeights.length === 0 &&
      constituents.every((c) => c.verified && c.status === "ACTIVE"),
    totalExpected: constituents.length,
  });
}
