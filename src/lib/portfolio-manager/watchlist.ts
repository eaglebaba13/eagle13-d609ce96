// Phase 52 — Watchlist utilities. Pure & deterministic.

import type { Watchlist, WatchlistItem } from "./types";

export function createWatchlist(id: string, name: string): Watchlist {
  return { id, name, items: [] };
}

export function addSymbol(wl: Watchlist, symbol: string, now: string = new Date().toISOString()): Watchlist {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return wl;
  if (wl.items.some((i) => i.symbol === sym)) return wl;
  const item: WatchlistItem = { symbol: sym, pinned: false, addedAt: now };
  return { ...wl, items: [...wl.items, item] };
}

export function removeSymbol(wl: Watchlist, symbol: string): Watchlist {
  return { ...wl, items: wl.items.filter((i) => i.symbol !== symbol) };
}

export function togglePin(wl: Watchlist, symbol: string): Watchlist {
  return {
    ...wl,
    items: wl.items.map((i) => (i.symbol === symbol ? { ...i, pinned: !i.pinned } : i)),
  };
}

export function sortWatchlist(wl: Watchlist): Watchlist {
  const items = [...wl.items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  });
  return { ...wl, items };
}

export function filterWatchlist(wl: Watchlist, query: string): readonly WatchlistItem[] {
  const q = query.trim().toUpperCase();
  if (!q) return sortWatchlist(wl).items;
  return sortWatchlist(wl).items.filter((i) => i.symbol.includes(q));
}