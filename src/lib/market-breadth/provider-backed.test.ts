import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProviderBackedBreadthBundle } from "./provider-backed.server";
import { PRODUCTION_NIFTY50_CONSTITUENTS, yahooSymbolForNifty50 } from "./production-registry";

describe("provider-backed breadth bundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns PARTIAL when only a subset of constituents resolves", async () => {
    const allYahooSymbols = PRODUCTION_NIFTY50_CONSTITUENTS.map((c) => yahooSymbolForNifty50(c.symbol));
    const resolvedSymbols = new Set(allYahooSymbols.slice(0, 20));

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const match = url.match(/\/([^/?#]+)\?/);
      const symbol = decodeURIComponent(match?.[1] ?? "");
      const hasQuote = resolvedSymbols.has(symbol);

      return new Response(JSON.stringify({
        chart: {
          result: hasQuote ? [{ meta: { regularMarketPrice: 100, chartPreviousClose: 95 } }] : [],
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));

    const bundle = await buildProviderBackedBreadthBundle(new Date("2026-08-03T10:00:00.000Z"));

    expect(bundle.summary.status).toBe("PARTIAL");
    expect(bundle.summary.safeWarnings).toContainEqual(expect.stringContaining("PARTIAL_COVERAGE"));
    expect(bundle.nifty50?.dataQuality).toBe("PARTIAL");
  });

  it("returns MARKET_CLOSED outside regular NSE hours", async () => {
    const bundle = await buildProviderBackedBreadthBundle(new Date("2026-08-01T16:00:00.000Z"));

    expect(bundle.summary.status).toBe("MARKET_CLOSED");
    expect(bundle.summary.safeWarnings).toContain("MARKET_CLOSED");
    expect(bundle.nifty50).toBeNull();
  });
});
