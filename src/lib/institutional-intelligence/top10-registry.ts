// Phase 49 — Top-10 NIFTY50 weighted constituents (approximate free-float
// weights, Q1 2025 vintage). Renormalized to sum to 1.0 across the basket.
// Provider-neutral; consumers pass Yahoo/Upstox quotes.

export const TOP10_REGISTRY_VERSION = "top10-registry@2025-01-30";

export interface Top10Constituent {
  readonly symbol: string; // NSE ticker
  readonly yahooSymbol: string; // Yahoo Finance symbol (.NS)
  readonly displayName: string;
  readonly weight: number; // 0..1 within the top-10 basket (sums to 1.0)
}

// Raw NIFTY50 index weights (approx, %). Renormalized below.
const RAW: readonly (Omit<Top10Constituent, "weight"> & { readonly raw: number })[] = [
  { symbol: "HDFCBANK",  yahooSymbol: "HDFCBANK.NS",  displayName: "HDFC Bank",   raw: 13.2 },
  { symbol: "RELIANCE",  yahooSymbol: "RELIANCE.NS",  displayName: "Reliance",    raw: 9.0 },
  { symbol: "ICICIBANK", yahooSymbol: "ICICIBANK.NS", displayName: "ICICI Bank",  raw: 8.5 },
  { symbol: "INFY",      yahooSymbol: "INFY.NS",      displayName: "Infosys",     raw: 6.2 },
  { symbol: "BHARTIARTL",yahooSymbol: "BHARTIARTL.NS",displayName: "Bharti Airtel",raw: 4.3 },
  { symbol: "ITC",       yahooSymbol: "ITC.NS",       displayName: "ITC",         raw: 4.0 },
  { symbol: "LT",        yahooSymbol: "LT.NS",        displayName: "L&T",         raw: 3.9 },
  { symbol: "TCS",       yahooSymbol: "TCS.NS",       displayName: "TCS",         raw: 3.8 },
  { symbol: "SBIN",      yahooSymbol: "SBIN.NS",      displayName: "SBI",         raw: 3.1 },
  { symbol: "AXISBANK",  yahooSymbol: "AXISBANK.NS",  displayName: "Axis Bank",   raw: 2.9 },
];

const TOTAL_RAW = RAW.reduce((s, r) => s + r.raw, 0);

export const TOP10_REGISTRY: readonly Top10Constituent[] = RAW.map((r) => ({
  symbol: r.symbol,
  yahooSymbol: r.yahooSymbol,
  displayName: r.displayName,
  weight: r.raw / TOTAL_RAW,
}));