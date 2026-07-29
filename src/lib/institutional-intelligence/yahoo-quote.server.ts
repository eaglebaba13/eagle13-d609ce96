// Phase 49 — Yahoo Finance quote batch fetcher (server-only).
// Uses the same /v8/finance/chart endpoint pattern already validated
// by src/lib/market.functions.ts. Best-effort: individual failures
// return null quotes rather than crashing the whole snapshot.

import type { QuoteSnapshot } from "./types";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }> | null;
  };
}

async function fetchOne(symbol: string): Promise<QuoteSnapshot> {
  try {
    const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 EagleBABA/1.0" },
    });
    if (!res.ok) return { symbol, last: null, changePct: null };
    const json = (await res.json()) as YahooChartResult;
    const meta = json.chart?.result?.[0]?.meta;
    const last = meta?.regularMarketPrice ?? null;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
    const changePct = last != null && prev != null && prev > 0
      ? Math.round(((last - prev) / prev) * 10000) / 100
      : null;
    return { symbol, last, changePct };
  } catch {
    return { symbol, last: null, changePct: null };
  }
}

export async function fetchYahooQuotes(symbols: readonly string[]): Promise<QuoteSnapshot[]> {
  return Promise.all(symbols.map(fetchOne));
}