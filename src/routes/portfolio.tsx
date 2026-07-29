import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  buildAllocation,
  buildReport,
  computePortfolioSummary,
  computeRiskReport,
  DEFAULT_LIMITS,
  demoPortfolio,
  positionPnl,
  positionsToCsv,
  reportToJson,
} from "@/lib/portfolio-manager";
import type { PortfolioState } from "@/lib/portfolio-manager";

const C = {
  bg: "var(--eb-bg)",
  card: "var(--eb-card)",
  border: "var(--eb-border)",
  text: "var(--eb-text)",
  muted: "var(--eb-muted)",
  bull: "var(--eb-bull)",
  bear: "var(--eb-bear)",
  accent: "var(--eb-accent)",
};

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
  head: () => ({
    meta: [
      { title: "Portfolio | EagleBABA" },
      { name: "description", content: "Portfolio dashboard — capital, P/L, positions and risk (demo mode)." },
      { property: "og:title", content: "Portfolio | EagleBABA" },
      { property: "og:description", content: "Track capital, positions and P/L in demo mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STORAGE_KEY = "eb:portfolio-demo";

function loadState(): PortfolioState {
  if (typeof window === "undefined") return demoPortfolio;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoPortfolio;
    const parsed = JSON.parse(raw) as PortfolioState;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.positions)) return demoPortfolio;
    return parsed;
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return demoPortfolio;
  }
}

function fmt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" | "neutral" }) {
  const color = tone === "pos" ? C.bull : tone === "neg" ? C.bear : C.text;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ color: C.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 600, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PortfolioPage() {
  const [state, setState] = useState<PortfolioState>(() => demoPortfolio);
  useEffect(() => { setState(loadState()); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const summary = useMemo(() => computePortfolioSummary(state), [state]);
  const risk = useMemo(() => computeRiskReport(state, DEFAULT_LIMITS), [state]);
  const allocation = useMemo(() => buildAllocation(state), [state]);

  const download = (name: string, mime: string, body: string) => {
    if (typeof window === "undefined") return;
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "1rem" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Portfolio</h1>
            <div style={{ color: C.muted, fontSize: 12 }}>Demo mode — positions are synthetic and do not represent live capital.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/watchlist" style={{ color: C.accent, fontSize: 13 }}>Watchlist →</Link>
            <Link to="/risk-center" style={{ color: C.accent, fontSize: 13 }}>Risk Center →</Link>
            <button onClick={() => download("portfolio.json", "application/json", reportToJson(buildReport(state)))} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>Export JSON</button>
            <button onClick={() => download("positions.csv", "text/csv", positionsToCsv(state))} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>Export CSV</button>
            <button onClick={() => typeof window !== "undefined" && window.print()} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>Print</button>
            <button onClick={() => { setState(demoPortfolio); }} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted, padding: "4px 10px", borderRadius: 6, fontSize: 12 }}>Reset Demo</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
          <KpiCard label="Total Capital" value={fmt(summary.totalCapital)} />
          <KpiCard label="Available" value={fmt(summary.availableCapital)} />
          <KpiCard label="Invested" value={fmt(summary.investedCapital)} />
          <KpiCard label="Unrealized P/L" value={fmt(summary.unrealizedPnl)} tone={summary.unrealizedPnl >= 0 ? "pos" : "neg"} />
          <KpiCard label="Realized P/L" value={fmt(summary.realizedPnl)} tone={summary.realizedPnl >= 0 ? "pos" : "neg"} />
          <KpiCard label="Daily P/L" value={fmt(summary.dailyPnl)} tone={summary.dailyPnl >= 0 ? "pos" : "neg"} />
          <KpiCard label="Weekly P/L" value={fmt(summary.weeklyPnl)} tone={summary.weeklyPnl >= 0 ? "pos" : "neg"} />
          <KpiCard label="Monthly P/L" value={fmt(summary.monthlyPnl)} tone={summary.monthlyPnl >= 0 ? "pos" : "neg"} />
          <KpiCard label="Total Return" value={`${summary.totalReturnPct.toFixed(2)}%`} tone={summary.totalReturnPct >= 0 ? "pos" : "neg"} />
          <KpiCard label="Open / Closed" value={`${summary.openPositions} / ${summary.closedPositions}`} />
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>Positions</div>
            <div style={{ fontSize: 12, color: risk.level === "CRITICAL" ? C.bear : risk.level === "HIGH" ? C.accent : C.muted }}>
              Risk: {risk.level} · Portfolio Risk {risk.portfolioRiskPct.toFixed(2)}% · Exposure {risk.exposurePct.toFixed(1)}%
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead style={{ color: C.muted, textAlign: "left" }}>
                <tr>
                  <th style={{ padding: "6px 8px" }}>Instrument</th>
                  <th>Dir</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Current</th>
                  <th>Stop</th>
                  <th>Target</th>
                  <th>P/L</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.positions.map((p) => {
                  const pnl = positionPnl(p);
                  return (
                    <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 8px" }}>{p.instrument}</td>
                      <td>{p.direction}</td>
                      <td>{p.quantity}</td>
                      <td>{p.entryPrice}</td>
                      <td>{p.status === "CLOSED" ? p.exitPrice : p.currentPrice}</td>
                      <td>{p.stopLoss ?? "—"}</td>
                      <td>{p.target ?? "—"}</td>
                      <td style={{ color: pnl >= 0 ? C.bull : C.bear }}>{fmt(pnl)}</td>
                      <td>{p.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Allocation</div>
          {allocation.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No open positions.</div>}
          {allocation.map((row) => (
            <div key={row.instrument} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>{row.instrument}</span>
                <span style={{ color: C.muted }}>{fmt(row.exposure)} · {row.pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                <div style={{ height: "100%", width: `${Math.min(100, row.pct)}%`, background: C.accent }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}