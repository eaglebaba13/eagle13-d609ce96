import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  BUILTIN_STRATEGIES,
  backtestToJson,
  generateReport,
  generateSyntheticBars,
  reportToPrintable,
  runBacktest,
  tradesToCsv,
  type BacktestResult,
  type Strategy,
} from "@/lib/strategy-builder";

const C = {
  bg: "var(--eb-bg)",
  card: "var(--eb-card)",
  border: "var(--eb-border)",
  text: "var(--eb-text)",
  muted: "var(--eb-muted)",
  accent: "var(--eb-accent)",
  bull: "var(--eb-bull)",
  bear: "var(--eb-bear)",
};

export const Route = createFileRoute("/backtesting-lab")({
  component: BacktestingLabPage,
  head: () => ({
    meta: [
      { title: "Backtesting Lab | EagleBABA" },
      { name: "description", content: "Run visual strategies over deterministic historical bars — win rate, profit factor, drawdown, monthly returns and equity curve." },
      { property: "og:title", content: "Backtesting Lab | EagleBABA" },
      { property: "og:description", content: "Deterministic backtesting for EagleBABA strategies with equity, drawdown and trade timeline charts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function loadDraft(): Strategy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("eb:strategy-draft");
    if (raw) return JSON.parse(raw) as Strategy;
  } catch { /* ignore */ }
  return null;
}

function BacktestingLabPage() {
  const draft = useMemo(loadDraft, []);
  const initialStrategies = useMemo<Strategy[]>(() => draft ? [draft, ...BUILTIN_STRATEGIES] : [...BUILTIN_STRATEGIES], [draft]);
  const [selectedId, setSelectedId] = useState<string>(initialStrategies[0].id);
  const [seed, setSeed] = useState(3);
  const [bars, setBars] = useState(250);

  const strategy = initialStrategies.find((s) => s.id === selectedId) ?? initialStrategies[0];
  const barsData = useMemo(() => generateSyntheticBars({ seed, bars }), [seed, bars]);
  const result = useMemo<BacktestResult>(() => runBacktest(strategy, barsData), [strategy, barsData]);
  const report = useMemo(() => generateReport(result), [result]);

  const download = (filename: string, mime: string, body: string) => {
    if (typeof window === "undefined") return;
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, padding: "1rem" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Backtesting Lab</h1>
            <p style={{ color: C.muted, margin: "4px 0 0", fontSize: 13 }}>
              Deterministic historical run. Independent Phase 51 module — decision engines are untouched.
            </p>
          </div>
          <Link to="/strategy-builder" style={btnGhost()}>← Back to Strategy Builder</Link>
        </header>

        <section style={panel()}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, alignItems: "end" }}>
            <label style={label()}>
              <span>Strategy</span>
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={input()}>
                {initialStrategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.id === "custom" ? " (draft)" : s.builtin ? " (built-in)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label style={label()}>
              <span>Seed</span>
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={input()} />
            </label>
            <label style={label()}>
              <span>Bars</span>
              <input type="number" value={bars} onChange={(e) => setBars(Math.max(20, Math.min(1000, Number(e.target.value))))} style={input()} />
            </label>
          </div>
          <p style={{ color: C.muted, fontSize: 11, margin: "6px 0 0" }}>
            Deterministic synthetic bars — same (seed, bars) always produces byte-identical results.
          </p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 12 }}>
          <Stat label="Total Trades" value={String(result.totalTrades)} />
          <Stat label="Win Rate" value={`${(result.winRate * 100).toFixed(1)}%`} tone={result.winRate >= 0.55 ? "bull" : undefined} />
          <Stat label="Loss Rate" value={`${(result.lossRate * 100).toFixed(1)}%`} />
          <Stat label="Profit Factor" value={Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"} tone={result.profitFactor >= 1.5 ? "bull" : undefined} />
          <Stat label="Expectancy" value={result.expectancy.toFixed(2)} tone={result.expectancy > 0 ? "bull" : "bear"} />
          <Stat label="Total P&L" value={result.totalPnl.toFixed(2)} tone={result.totalPnl > 0 ? "bull" : "bear"} />
          <Stat label="Max Drawdown" value={`${result.maxDrawdown.toFixed(2)} (${result.maxDrawdownPct.toFixed(1)}%)`} tone="bear" />
          <Stat label="Avg Hold (bars)" value={result.avgHoldBars.toFixed(1)} />
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Equity Curve</h2>
          <MiniLine data={result.equityCurve.map((p) => p.equity)} color={C.bull} />
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Drawdown Curve</h2>
          <MiniLine data={result.drawdownCurve.map((p) => -p.dd)} color={C.bear} />
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Monthly Performance</h2>
          {result.monthlyReturns.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>No trades — nothing to aggregate.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
              {result.monthlyReturns.map((m) => {
                const max = Math.max(...result.monthlyReturns.map((x) => Math.abs(x.pnl)), 1);
                const h = (Math.abs(m.pnl) / max) * 100;
                return (
                  <div key={m.month} title={`${m.month}: ${m.pnl.toFixed(2)}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 24, height: `${h}%`, background: m.pnl >= 0 ? C.bull : C.bear, borderRadius: 3 }} />
                    <span style={{ color: C.muted, fontSize: 9 }}>{m.month.slice(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Win / Loss Distribution</h2>
          <WinLossHistogram trades={result.trades} />
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Trade Timeline</h2>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: "left" }}>
                  <th style={th()}>Entry</th><th style={th()}>Exit</th><th style={th()}>Side</th>
                  <th style={th()}>Entry Px</th><th style={th()}>Exit Px</th><th style={th()}>P&L</th>
                  <th style={th()}>%</th><th style={th()}>Bars</th><th style={th()}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={td()}>{new Date(t.entryTime).toISOString().slice(0, 10)}</td>
                    <td style={td()}>{new Date(t.exitTime).toISOString().slice(0, 10)}</td>
                    <td style={{ ...td(), color: t.side === "CALL" ? C.bull : C.bear }}>{t.side}</td>
                    <td style={td()}>{t.entryPrice.toFixed(2)}</td>
                    <td style={td()}>{t.exitPrice.toFixed(2)}</td>
                    <td style={{ ...td(), color: t.pnl >= 0 ? C.bull : C.bear }}>{t.pnl.toFixed(2)}</td>
                    <td style={td()}>{t.pnlPct.toFixed(2)}%</td>
                    <td style={td()}>{t.holdBars}</td>
                    <td style={td()}>{t.exitReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Strategy Report</h2>
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>{report.summary}</p>
          <ReportList title="Strengths" items={report.strengths} color={C.bull} />
          <ReportList title="Weaknesses" items={report.weaknesses} color={C.bear} />
          <ReportList title="Risk" items={report.risk} color={C.accent} />
          <ReportList title="Suggested Improvements" items={report.improvements} color={C.text} />
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Export</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnGhost()} onClick={() => download(`${strategy.id}-trades.csv`, "text/csv", tradesToCsv(result))}>Export CSV</button>
            <button style={btnGhost()} onClick={() => download(`${strategy.id}-backtest.json`, "application/json", backtestToJson(strategy, result, report))}>Export JSON</button>
            <button style={btnGhost()} onClick={() => {
              const body = reportToPrintable(strategy, result, report);
              const w = typeof window !== "undefined" ? window.open("", "_blank") : null;
              if (w) {
                w.document.write(`<pre style="font-family:ui-monospace,monospace;padding:24px;white-space:pre-wrap">${body.replace(/</g, "&lt;")}</pre>`);
                w.document.title = `${strategy.name} — Report`;
                w.focus(); w.print();
              }
            }}>Export PDF (Print)</button>
          </div>
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Assumptions</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: C.muted, fontSize: 12 }}>
            {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  const color = tone === "bull" ? C.bull : tone === "bear" ? C.bear : C.text;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
      <div style={{ color: C.muted, fontSize: 11 }}>{label}</div>
      <div style={{ color, fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function MiniLine({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) return <div style={{ color: C.muted, fontSize: 12 }}>No data.</div>;
  const W = 800, H = 120, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function WinLossHistogram({ trades }: { trades: BacktestResult["trades"] }) {
  if (trades.length === 0) return <div style={{ color: C.muted, fontSize: 12 }}>No trades.</div>;
  const buckets = new Map<number, number>();
  for (const t of trades) {
    const b = Math.round(t.pnlPct);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const entries = [...buckets.entries()].sort(([a], [b]) => a - b);
  const maxCount = Math.max(...entries.map(([, n]) => n));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100 }}>
      {entries.map(([pct, n]) => (
        <div key={pct} title={`${pct}%: ${n} trades`}
          style={{ width: 12, height: `${(n / maxCount) * 100}%`, background: pct >= 0 ? C.bull : C.bear, borderRadius: 2 }} />
      ))}
    </div>
  );
}

function ReportList({ title, items, color }: { title: string; items: readonly string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color, fontWeight: 600 }}>{title}</div>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, color: C.muted }}>
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function panel(): React.CSSProperties {
  return { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
}
function h2(): React.CSSProperties { return { fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: C.text }; }
function input(): React.CSSProperties {
  return { background: "rgba(0,0,0,0.35)", color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
}
function label(): React.CSSProperties { return { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: C.muted }; }
function btnGhost(): React.CSSProperties {
  return { background: "transparent", color: C.text, border: `1px solid ${C.border}`, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, textDecoration: "none" };
}
function th(): React.CSSProperties { return { padding: "6px 8px", fontWeight: 500, fontSize: 11 }; }
function td(): React.CSSProperties { return { padding: "4px 8px" }; }