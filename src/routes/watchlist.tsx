import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  addSymbol,
  createWatchlist,
  demoWatchlist,
  filterWatchlist,
  removeSymbol,
  togglePin,
} from "@/lib/portfolio-manager";
import type { Watchlist } from "@/lib/portfolio-manager";

const C = {
  bg: "var(--eb-bg)", card: "var(--eb-card)", border: "var(--eb-border)",
  text: "var(--eb-text)", muted: "var(--eb-muted)", accent: "var(--eb-accent)",
  bull: "var(--eb-bull)",
};

export const Route = createFileRoute("/watchlist")({
  component: WatchlistPage,
  head: () => ({
    meta: [
      { title: "Watchlist | EagleBABA" },
      { name: "description", content: "Personal watchlists — pin favourites and jump to the AI Decision Center." },
      { property: "og:title", content: "Watchlist | EagleBABA" },
      { property: "og:description", content: "Track symbols across multiple watchlists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STORAGE_KEY = "eb:watchlists";

function loadLists(): Watchlist[] {
  if (typeof window === "undefined") return [demoWatchlist];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [demoWatchlist];
    const parsed = JSON.parse(raw) as Watchlist[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [demoWatchlist];
    return parsed;
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return [demoWatchlist];
  }
}

function WatchlistPage() {
  const [lists, setLists] = useState<Watchlist[]>(() => [demoWatchlist]);
  const [activeId, setActiveId] = useState<string>(demoWatchlist.id);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    const l = loadLists();
    setLists(l);
    setActiveId(l[0]?.id ?? demoWatchlist.id);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists)); } catch { /* ignore */ }
  }, [lists]);

  const active = useMemo(() => lists.find((l) => l.id === activeId) ?? lists[0], [lists, activeId]);
  const items = useMemo(() => (active ? filterWatchlist(active, query) : []), [active, query]);

  const update = (fn: (w: Watchlist) => Watchlist) => {
    if (!active) return;
    setLists((prev) => prev.map((l) => (l.id === active.id ? fn(l) : l)));
  };

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "1rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Watchlist</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/portfolio" style={{ color: C.accent, fontSize: 13 }}>Portfolio →</Link>
            <Link to="/risk-center" style={{ color: C.accent, fontSize: 13 }}>Risk Center →</Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Lists</div>
            {lists.map((l) => (
              <div key={l.id} onClick={() => setActiveId(l.id)} style={{ padding: "6px 8px", cursor: "pointer", borderRadius: 4, background: l.id === activeId ? C.border : "transparent", fontSize: 13 }}>
                {l.name} <span style={{ color: C.muted }}>({l.items.length})</span>
              </div>
            ))}
            <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
              <input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="New list" style={{ flex: 1, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 6px", fontSize: 12 }} />
              <button
                onClick={() => {
                  const name = newListName.trim();
                  if (!name) return;
                  const id = `wl-${Date.now()}`;
                  setLists((prev) => [...prev, createWatchlist(id, name)]);
                  setNewListName("");
                  setActiveId(id);
                }}
                style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 12 }}
              >Add</button>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add symbol (e.g. NIFTY)" style={{ flex: "1 1 160px", background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 13 }} />
              <button
                onClick={() => { const s = input.trim(); if (!s) return; update((w) => addSymbol(w, s)); setInput(""); }}
                style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 4, padding: "4px 12px", fontSize: 13 }}
              >Add</button>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search / filter" style={{ flex: "1 1 160px", background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 13 }} />
            </div>
            {items.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 12 }}>No symbols match.</div>
            ) : (
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead style={{ color: C.muted, textAlign: "left" }}>
                  <tr><th style={{ padding: "6px 8px" }}>Symbol</th><th>Added</th><th style={{ width: 240 }}>Actions</th></tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.symbol} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 8px" }}>
                        {it.pinned && <span style={{ color: C.accent, marginRight: 4 }}>★</span>}
                        {it.symbol}
                      </td>
                      <td style={{ color: C.muted }}>{new Date(it.addedAt).toLocaleDateString()}</td>
                      <td>
                        <button onClick={() => update((w) => togglePin(w, it.symbol))} style={{ marginRight: 6, background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{it.pinned ? "Unpin" : "Pin"}</button>
                        <Link to="/ai-decision-center" style={{ marginRight: 6, color: C.accent, fontSize: 11 }}>AI Decision</Link>
                        <button onClick={() => update((w) => removeSymbol(w, it.symbol))} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted, padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}