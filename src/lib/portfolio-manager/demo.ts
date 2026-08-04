// Phase 52 — Demo portfolio seed. Deterministic. NOT live data.

import type { PortfolioState, Watchlist } from "./types";

export const demoPortfolio: PortfolioState = {
  totalCapital: 500_000,
  positions: [
    {
      id: "p-1",
      instrument: "NIFTY 24500 CE",
      direction: "CALL",
      entryPrice: 120,
      currentPrice: 148,
      quantity: 75,
      stopLoss: 95,
      target: 180,
      status: "OPEN",
      openedAt: "2026-07-28T04:15:00Z",
    },
    {
      id: "p-2",
      instrument: "BANKNIFTY 52000 PE",
      direction: "PUT",
      entryPrice: 210,
      currentPrice: 188,
      quantity: 30,
      stopLoss: 245,
      target: 150,
      status: "OPEN",
      openedAt: "2026-07-28T05:20:00Z",
    },
    {
      id: "p-3",
      instrument: "RELIANCE",
      direction: "LONG",
      entryPrice: 2950,
      currentPrice: 3010,
      quantity: 50,
      stopLoss: 2900,
      target: 3080,
      status: "CLOSED",
      exitPrice: 3010,
      openedAt: "2026-07-24T04:10:00Z",
      closedAt: "2026-07-25T09:45:00Z",
    },
  ],
  ledger: [
    { ts: "2026-07-25T09:45:00Z", pnl: 3000 },
    { ts: "2026-07-27T09:45:00Z", pnl: -1200 },
    { ts: "2026-07-28T09:45:00Z", pnl: 850 },
  ],
};

export const demoWatchlist: Watchlist = {
  id: "wl-default",
  name: "Default",
  items: [
    { symbol: "NIFTY", pinned: true, addedAt: "2026-07-20T00:00:00Z" },
    { symbol: "BANKNIFTY", pinned: true, addedAt: "2026-07-20T00:00:00Z" },
    { symbol: "RELIANCE", pinned: false, addedAt: "2026-07-21T00:00:00Z" },
    { symbol: "TCS", pinned: false, addedAt: "2026-07-22T00:00:00Z" },
    { symbol: "HDFCBANK", pinned: false, addedAt: "2026-07-22T00:00:00Z" },
  ],
};