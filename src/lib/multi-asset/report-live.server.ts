// Phase 44D — Live provider wiring for the morning brief.
// Server-only: imports market/news/coindcx/astro modules and produces
// a fully hydrated ComposeInput. Modules that don't have a validated
// live collector (India context, FII/DII) remain UNAVAILABLE.

import { getMarketDataImpl, type IndexQuote } from "@/lib/market.functions";
import { getMarketSnapshots, getCandleSnapshot } from "@/lib/providers/coindcx/coindcx.server";
import { BRIEF_INSTRUMENTS, resolveCoindcxPair, type BriefInstrument } from "./instruments";
import { buildLevelBundle } from "./level-bundle";
import { computeMarketBias } from "./market-bias";
import { computePanchangBundle, type PanchangBundle } from "./panchang-bundle";
import { computeAstroPositions } from "@/lib/astro-engine.server";
import { selectPreviousCompletedDaily, type RawDailyCandle, type SelectedCandle } from "./daily-candle";
import {
  MACRO_LOWER_THRESHOLD, MACRO_UPPER_THRESHOLD, MACRO_RATIO_VERSION,
  type MacroRatioResult,
} from "./macro-ratio";
import { buildReportId } from "./report-composer";
import type {
  ComposeInput, InstrumentBlock, IndiaContextBlock, FiiDiiBlock, DataQuality,
} from "./report-composer";
import { buildInstitutionalIntelligenceSnapshot } from "@/lib/institutional-intelligence/snapshot.server";

function unavailableInstrument(inst: BriefInstrument): InstrumentBlock {
  return {
    instrumentId: inst.id, displayName: inst.displayName,
    bundle: null, bias: null, livePrice: null, status: "UNAVAILABLE",
  };
}

function buildBlockFromCandle(
  inst: BriefInstrument,
  candle: SelectedCandle,
  livePrice: number | null,
  quality: DataQuality,
): InstrumentBlock {
  const bundle = buildLevelBundle(inst, candle);
  const bias = computeMarketBias({ instrument: inst, bundle, livePrice, macro: null });
  return {
    instrumentId: inst.id,
    displayName: inst.displayName,
    bundle,
    bias,
    livePrice,
    status: quality,
  };
}

function candleFromIndexQuote(q: IndexQuote): RawDailyCandle {
  return {
    openTime: `${q.prevDay.date}T00:00:00Z`,
    open: q.prevDay.open, high: q.prevDay.high, low: q.prevDay.low, close: q.prevDay.close,
    complete: true,
  };
}

function blockFromIndexQuote(
  inst: BriefInstrument,
  quote: IndexQuote | null | undefined,
): InstrumentBlock {
  if (!quote) return unavailableInstrument(inst);
  const selected = selectPreviousCompletedDaily({
    candles: [candleFromIndexQuote(quote)],
    providerTimezone: "Asia/Kolkata",
    session24x7: false,
  });
  if (!selected) return unavailableInstrument(inst);
  const quality: DataQuality =
    selected.freshness === "FRESH" ? "LIVE" :
    selected.freshness === "STALE" ? "STALE" : "UNAVAILABLE";
  return buildBlockFromCandle(inst, selected, quote.livePrice, quality);
}

async function blockFromCoindcx(
  inst: BriefInstrument,
  nowIso: string,
): Promise<InstrumentBlock> {
  try {
    const snaps = await getMarketSnapshots(nowIso);
    const markets = snaps.map((s) => ({
      base: s.market.base,
      quote: s.market.quote,
      pair: s.market.pair,
    }));
    const resolved = resolveCoindcxPair(inst, markets);
    if (!resolved) return unavailableInstrument(inst);
    const snap = snaps.find((s) => s.market.pair === resolved.pair);
    const livePrice = snap?.ticker?.last ?? null;
    const candleSnap = await getCandleSnapshot({ pair: resolved.pair, interval: "1d", nowIso });
    if (!candleSnap || candleSnap.candles.length === 0) {
      return unavailableInstrument(inst);
    }
    const raws: RawDailyCandle[] = candleSnap.candles.map((c) => ({
      openTime: c.time,
      open: c.open, high: c.high, low: c.low, close: c.close,
      volume: c.volume ?? null,
      complete: Date.parse(c.time) + 86_400_000 <= Date.now(),
    }));
    const selected = selectPreviousCompletedDaily({
      candles: raws, providerTimezone: "UTC", session24x7: true,
    });
    if (!selected) return unavailableInstrument(inst);
    const quality: DataQuality =
      selected.freshness === "FRESH" ? "LIVE" :
      selected.freshness === "STALE" ? "STALE" : "UNAVAILABLE";
    return buildBlockFromCandle(inst, selected, livePrice, quality);
  } catch {
    return unavailableInstrument(inst);
  }
}

function buildMacroRatio(
  gold: IndexQuote | null | undefined,
  silver: IndexQuote | null | undefined,
  nowIso: string,
): MacroRatioResult {
  const gp = gold?.livePrice ?? null;
  const sp = silver?.livePrice ?? null;
  if (!gp || !sp || sp <= 0) {
    return {
      ratio: null, macroBias: "UNAVAILABLE",
      goldBias: "UNAVAILABLE", silverBias: "UNAVAILABLE",
      action: "WAIT",
      lowerThreshold: MACRO_LOWER_THRESHOLD, upperThreshold: MACRO_UPPER_THRESHOLD,
      normalizedGold: null, normalizedSilver: null, quoteCurrency: "USD",
      normalizationMethod: "UNAVAILABLE", freshness: "UNAVAILABLE",
      calculatedAt: nowIso,
      goldSource: { price: gp, timestamp: gold?.updatedAt ?? null, provider: "yahoo-futures" },
      silverSource: { price: sp, timestamp: silver?.updatedAt ?? null, provider: "yahoo-futures" },
      reason: "Gold/Silver quote unavailable",
      version: MACRO_RATIO_VERSION,
    };
  }
  const ratio = Math.round((gp / sp) * 100) / 100;
  const macroBias =
    ratio > MACRO_UPPER_THRESHOLD ? "BUY_SILVER" :
    ratio < MACRO_LOWER_THRESHOLD ? "BUY_GOLD" : "NEUTRAL";
  const goldBias =
    macroBias === "BUY_GOLD" ? "BULLISH_RELATIVE" :
    macroBias === "BUY_SILVER" ? "BEARISH_RELATIVE" : "NEUTRAL";
  const silverBias =
    macroBias === "BUY_SILVER" ? "BULLISH_RELATIVE" :
    macroBias === "BUY_GOLD" ? "BEARISH_RELATIVE" : "NEUTRAL";
  return {
    ratio, macroBias, goldBias, silverBias,
    action: macroBias === "NEUTRAL" ? "WAIT" : "OBSERVE",
    lowerThreshold: MACRO_LOWER_THRESHOLD, upperThreshold: MACRO_UPPER_THRESHOLD,
    normalizedGold: gp, normalizedSilver: sp, quoteCurrency: "USD",
    normalizationMethod: "PRICE_PER_TROY_OUNCE", freshness: "LIVE",
    calculatedAt: nowIso,
    goldSource: { price: gp, timestamp: gold?.updatedAt ?? null, provider: "yahoo-futures" },
    silverSource: { price: sp, timestamp: silver?.updatedAt ?? null, provider: "yahoo-futures" },
    reason: `Ratio ${ratio} vs thresholds ${MACRO_LOWER_THRESHOLD}/${MACRO_UPPER_THRESHOLD}`,
    version: MACRO_RATIO_VERSION,
  };
}

function computeLivePanchang(now: number): PanchangBundle | null {
  try {
    const positions = computeAstroPositions(new Date(now));
    const sun = positions.planets.find((p) => p.planet === "Sun");
    const moon = positions.planets.find((p) => p.planet === "Moon");
    if (!sun || !moon) return null;
    return computePanchangBundle({ sunAbs: sun.absDegree, moonAbs: moon.absDegree, now });
  } catch {
    return null;
  }
}

function overallQuality(blocks: InstrumentBlock[]): DataQuality {
  const live = blocks.filter((b) => b.status === "LIVE").length;
  const any = blocks.length;
  if (live === any) return "LIVE";
  if (live === 0) return "UNAVAILABLE";
  return "PARTIAL";
}

export async function buildLivePayload(reportDate: string, generatedAt: string): Promise<ComposeInput> {
  const nowMs = Date.parse(generatedAt) || Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const [market, btcBlock, ethBlock] = await Promise.all([
    getMarketDataImpl().catch(() => null),
    blockFromCoindcx(BRIEF_INSTRUMENTS.find((i) => i.id === "BTC")!, nowIso),
    blockFromCoindcx(BRIEF_INSTRUMENTS.find((i) => i.id === "ETH")!, nowIso),
  ]);

  const inst = (id: BriefInstrument["id"]) => BRIEF_INSTRUMENTS.find((i) => i.id === id)!;
  const nifty = blockFromIndexQuote(inst("NIFTY"), market?.nifty);
  const banknifty = blockFromIndexQuote(inst("BANKNIFTY"), market?.banknifty);
  const xauusd = blockFromIndexQuote(inst("XAUUSD"), market?.gold);
  const xagusd = blockFromIndexQuote(inst("XAGUSD"), market?.silver);

  const ratio = buildMacroRatio(market?.gold ?? null, market?.silver ?? null, nowIso);
  const panchang = computeLivePanchang(nowMs);

  const vix = market?.vix?.livePrice ?? null;
  const marketState = market?.nifty?.marketState ?? "UNAVAILABLE";
  const india: IndiaContextBlock = {
    indiaVix: vix,
    top5Bullish: [], top5Bearish: [],
    strongestSectors: [], weakestSectors: [],
    institutionalFlowProbability: null,
    marketStatus: marketState === "OPEN" ? "OPEN" : marketState === "CLOSED" ? "CLOSED" : "UNAVAILABLE",
    latestTradeDate: market?.nifty?.prevDay?.date ?? null,
    status: vix != null ? "PARTIAL" : "UNAVAILABLE",
  };
  const fii: FiiDiiBlock = {
    tradeDate: null, fiiNet: null, diiNet: null,
    publicationStatus: "UNAVAILABLE", status: "UNAVAILABLE",
  };

  const blocks = [nifty, banknifty, xauusd, xagusd, btcBlock, ethBlock];
  const institutionalIntelligence = await buildInstitutionalIntelligenceSnapshot({
    vix,
    combinedPcr: null,
    globalCompositeBiasPct: null,
  }).catch(() => null);

  return {
    reportDate, generatedAt,
    reportId: buildReportId(reportDate),
    panchang,
    nifty, banknifty,
    xauusd, xagusd,
    btc: btcBlock, eth: ethBlock,
    ratio,
    indiaContext: india, fiiDii: fii,
    institutionalIntelligence,
    overallStatus: overallQuality(blocks),
  };
}