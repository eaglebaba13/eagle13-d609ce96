import { computeBreadth } from "./breadth-calc";
import { getNseMarketSessionState, type BreadthMarketSessionPolicy } from "./market-session";
import {
  PRODUCTION_NIFTY50_CONSTITUENTS,
  PRODUCTION_NIFTY50_PROVIDER_ALIAS,
  PRODUCTION_NIFTY50_REGISTRY_VERSION,
  validateProductionNifty50Registry,
  yahooSymbolForNifty50,
} from "./production-registry";
import { SECTOR_REGISTRY, SECTOR_REGISTRY_VERSION } from "./sector-registry";
import { topWeightedBasket } from "./nifty50-registry";
import type { BreadthUniverse, MarketBreadthSnapshot, SymbolTick } from "./types";
import { fetchYahooQuotes } from "@/lib/institutional-intelligence/yahoo-quote.server";
import type { QuoteSnapshot } from "@/lib/institutional-intelligence/types";

export type BreadthLoadStatus = "LIVE" | "PARTIAL" | "STALE" | "MARKET_CLOSED" | "UNAVAILABLE";

export interface ProviderBreadthLoadSummary {
  readonly attempted: number;
  readonly received: number;
  readonly valid: number;
  readonly stale: number;
  readonly unavailable: number;
  readonly failed: number;
  readonly provider: string;
  readonly observedAt: string;
  readonly safeWarnings: readonly string[];
  readonly status: BreadthLoadStatus;
  readonly marketSession: BreadthMarketSessionPolicy;
}

export interface ProviderBreadthBundle {
  readonly broad: MarketBreadthSnapshot | null;
  readonly nifty50: MarketBreadthSnapshot | null;
  readonly topWeighted: MarketBreadthSnapshot | null;
  readonly banking: MarketBreadthSnapshot | null;
  readonly it: MarketBreadthSnapshot | null;
  readonly oilGas: MarketBreadthSnapshot | null;
  readonly auto: MarketBreadthSnapshot | null;
  readonly summary: ProviderBreadthLoadSummary;
}

const BATCH_SIZE = 10;
const MIN_PARTIAL_COVERAGE = 0.4;
const MIN_READY_COVERAGE = 0.8;

function quoteMap(quotes: readonly QuoteSnapshot[]): ReadonlyMap<string, QuoteSnapshot> {
  const map = new Map<string, QuoteSnapshot>();
  for (const q of quotes) map.set(q.symbol, q);
  return map;
}

function tickFor(symbol: string, quotes: ReadonlyMap<string, QuoteSnapshot>): SymbolTick {
  const yahoo = yahooSymbolForNifty50(symbol);
  const q = quotes.get(yahoo) ?? quotes.get(symbol);
  const change = q?.changePct ?? null;
  return {
    symbol,
    direction: change == null ? "UNAVAILABLE" : change > 0.05 ? "ADVANCE" : change < -0.05 ? "DECLINE" : "UNCHANGED",
    changePercent: change,
  };
}

function weightsFor(symbols: readonly string[]): ReadonlyMap<string, number> {
  const allowed = new Set(symbols);
  return new Map(PRODUCTION_NIFTY50_CONSTITUENTS.filter((c) => allowed.has(c.symbol)).map((c) => [c.symbol, c.weight]));
}

function buildSnapshot(input: {
  readonly universe: BreadthUniverse;
  readonly symbols: readonly string[];
  readonly quotes: ReadonlyMap<string, QuoteSnapshot>;
  readonly nowIso: string;
  readonly freshnessMs: number | undefined;
  readonly registryVersion: string;
}): MarketBreadthSnapshot {
  return computeBreadth({
    universe: input.universe,
    provider: PRODUCTION_NIFTY50_PROVIDER_ALIAS,
    timestamp: input.nowIso,
    expectedSymbols: input.symbols,
    weights: weightsFor(input.symbols),
    ticks: input.symbols.map((s) => tickFor(s, input.quotes)),
    registryVersion: input.registryVersion,
    freshnessMs: input.freshnessMs,
    snapshotId: `${input.universe.toLowerCase()}-${input.nowIso}`,
  });
}

async function fetchBatched(symbols: readonly string[]): Promise<QuoteSnapshot[]> {
  const quotes: QuoteSnapshot[] = [];
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    quotes.push(...await fetchYahooQuotes(batch));
  }
  return quotes;
}

export async function buildProviderBackedBreadthBundle(
  now: Date = new Date(),
): Promise<ProviderBreadthBundle> {
  const nowIso = now.toISOString();
  const session = getNseMarketSessionState(now);
  const validation = validateProductionNifty50Registry();
  const allSymbols = PRODUCTION_NIFTY50_CONSTITUENTS.map((c) => c.symbol);
  const allYahooSymbols = allSymbols.map(yahooSymbolForNifty50);
  const warnings: string[] = [];

  if (!validation.verified) {
    warnings.push("REGISTRY_INCOMPLETE");
    return emptyBundle(nowIso, session, allSymbols.length, "UNAVAILABLE", warnings);
  }

  if (session.state === "CLOSED") {
    warnings.push("MARKET_CLOSED");
    return emptyBundle(nowIso, session, allSymbols.length, "MARKET_CLOSED", warnings);
  }

  const quotes = await fetchBatched(allYahooSymbols);
  const bySymbol = quoteMap(quotes);
  const valid = quotes.filter((q) => q.changePct != null && Number.isFinite(q.changePct)).length;
  const unavailable = Math.max(0, allSymbols.length - valid);
  const coverage = allSymbols.length > 0 ? valid / allSymbols.length : 0;
  if (coverage < 1) warnings.push(`PARTIAL_COVERAGE:${valid}/${allSymbols.length}`);

  const freshnessMs = session.state === "REGULAR" ? 0 : undefined;
  const nifty50 = buildSnapshot({
    universe: "NIFTY50",
    symbols: allSymbols,
    quotes: bySymbol,
    nowIso,
    freshnessMs,
    registryVersion: PRODUCTION_NIFTY50_REGISTRY_VERSION,
  });
  const topSymbols = topWeightedBasket(10).map((c) => c.symbol);
  const topWeighted = buildSnapshot({
    universe: "NIFTY_TOP_WEIGHTED",
    symbols: topSymbols,
    quotes: bySymbol,
    nowIso,
    freshnessMs,
    registryVersion: PRODUCTION_NIFTY50_REGISTRY_VERSION,
  });
  const sectorSnapshots = SECTOR_REGISTRY.map((sector) => buildSnapshot({
    universe: (`SECTOR_${sector.id}`) as BreadthUniverse,
    symbols: sector.constituents.map((c) => c.symbol),
    quotes: bySymbol,
    nowIso,
    freshnessMs,
    registryVersion: SECTOR_REGISTRY_VERSION,
  }));

  const status: BreadthLoadStatus = coverage >= MIN_READY_COVERAGE ? "LIVE" : coverage >= MIN_PARTIAL_COVERAGE ? "PARTIAL" : "UNAVAILABLE";

  return Object.freeze({
    broad: nifty50,
    nifty50,
    topWeighted,
    banking: sectorSnapshots.find((s) => s.universe === "SECTOR_BANKING") ?? null,
    it: sectorSnapshots.find((s) => s.universe === "SECTOR_IT") ?? null,
    oilGas: sectorSnapshots.find((s) => s.universe === "SECTOR_OIL_GAS") ?? null,
    auto: sectorSnapshots.find((s) => s.universe === "SECTOR_AUTO") ?? null,
    summary: Object.freeze({
      attempted: allSymbols.length,
      received: quotes.length,
      valid,
      stale: 0,
      unavailable,
      failed: 0,
      provider: PRODUCTION_NIFTY50_PROVIDER_ALIAS,
      observedAt: nowIso,
      safeWarnings: Object.freeze(warnings),
      status,
      marketSession: session,
    }),
  });
}

function emptyBundle(
  nowIso: string,
  session: BreadthMarketSessionPolicy,
  attempted: number,
  status: BreadthLoadStatus,
  warnings: readonly string[],
): ProviderBreadthBundle {
  return Object.freeze({
    broad: null,
    nifty50: null,
    topWeighted: null,
    banking: null,
    it: null,
    oilGas: null,
    auto: null,
    summary: Object.freeze({
      attempted,
      received: 0,
      valid: 0,
      stale: 0,
      unavailable: attempted,
      failed: status === "UNAVAILABLE" ? attempted : 0,
      provider: PRODUCTION_NIFTY50_PROVIDER_ALIAS,
      observedAt: nowIso,
      safeWarnings: Object.freeze([...warnings]),
      status,
      marketSession: session,
    }),
  });
}
