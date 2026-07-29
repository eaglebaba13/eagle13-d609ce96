import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  BUILTIN_STRATEGIES,
  INDICATOR_META,
  type Comparator,
  type Condition,
  type IndicatorId,
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

export const Route = createFileRoute("/strategy-builder")({
  component: StrategyBuilderPage,
  head: () => ({
    meta: [
      { title: "Strategy Builder | EagleBABA" },
      { name: "description", content: "No-code visual strategy builder — combine GTI, Astro, Gann, VIX, PCR, Institutional Score, Breadth, Sector, AI Decision and Option Chain into deterministic rules." },
      { property: "og:title", content: "Strategy Builder | EagleBABA" },
      { property: "og:description", content: "Visually design entry, exit and risk rules for backtestable trading strategies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const INDICATOR_IDS = Object.keys(INDICATOR_META) as IndicatorId[];
const COMPARATORS: Comparator[] = [">", "<", ">=", "<=", "="];

type DraftStrategy = Strategy;

function emptyCondition(): Condition {
  return { id: crypto.randomUUID(), indicator: "GTI", op: ">", value: 50 };
}

function loadDraft(): DraftStrategy {
  if (typeof window === "undefined") return blankStrategy();
  try {
    const raw = window.localStorage.getItem("eb:strategy-draft");
    if (raw) return JSON.parse(raw) as DraftStrategy;
  } catch { /* ignore */ }
  return blankStrategy();
}

function blankStrategy(): DraftStrategy {
  return {
    id: "custom",
    name: "My Strategy",
    description: "",
    entry: { id: "root", combinator: "AND", conditions: [emptyCondition()] },
    action: { kind: "BUY_CALL" },
    risk: { targetPct: 1.5, stopPct: 0.8 },
  };
}

function StrategyBuilderPage() {
  const [draft, setDraft] = useState<DraftStrategy>(() => loadDraft());

  const persist = (next: DraftStrategy) => {
    setDraft(next);
    if (typeof window !== "undefined") window.localStorage.setItem("eb:strategy-draft", JSON.stringify(next));
  };

  const updateCondition = (idx: number, patch: Partial<Condition>) => {
    const conditions = draft.entry.conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    persist({ ...draft, entry: { ...draft.entry, conditions } });
  };
  const addCondition = () => persist({ ...draft, entry: { ...draft.entry, conditions: [...draft.entry.conditions, emptyCondition()] } });
  const removeCondition = (idx: number) => persist({ ...draft, entry: { ...draft.entry, conditions: draft.entry.conditions.filter((_, i) => i !== idx) } });

  const loadTemplate = (id: string) => {
    const t = BUILTIN_STRATEGIES.find((s) => s.id === id);
    if (t) persist({ ...t, id: "custom", name: `${t.name} (copy)`, builtin: false });
  };

  const openInLab = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("eb:strategy-draft", JSON.stringify(draft));
      window.location.href = "/backtesting-lab?source=draft";
    }
  };

  const risk = draft.risk ?? {};
  const setRisk = (patch: Partial<NonNullable<DraftStrategy["risk"]>>) =>
    persist({ ...draft, risk: { ...risk, ...patch } });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, padding: "1rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Strategy Builder</h1>
            <p style={{ color: C.muted, margin: "4px 0 0", fontSize: 13 }}>
              Combine indicators into deterministic rules — send to the Backtesting Lab when ready.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/backtesting-lab" style={btnGhost()}>Open Backtesting Lab</Link>
            <button onClick={openInLab} style={btnPrimary()}>Run Backtest →</button>
          </div>
        </header>

        <section style={panel()}>
          <h2 style={h2()}>1. Strategy Library</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {BUILTIN_STRATEGIES.map((s) => (
              <button key={s.id} onClick={() => loadTemplate(s.id)} style={chip()}>{s.name}</button>
            ))}
          </div>
        </section>

        <section style={panel()}>
          <h2 style={h2()}>2. Strategy Details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={label()}>
              <span>Name</span>
              <input value={draft.name} onChange={(e) => persist({ ...draft, name: e.target.value })} style={input()} />
            </label>
            <label style={label()}>
              <span>Description</span>
              <input value={draft.description ?? ""} onChange={(e) => persist({ ...draft, description: e.target.value })} style={input()} />
            </label>
          </div>
        </section>

        <section style={panel()}>
          <h2 style={h2()}>3. Entry Rules</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ color: C.muted, fontSize: 12 }}>Combine with</span>
            <select value={draft.entry.combinator} onChange={(e) => persist({ ...draft, entry: { ...draft.entry, combinator: e.target.value as "AND" | "OR" } })} style={input()}>
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 12 }}>
              <input type="checkbox" checked={!!draft.entry.negate} onChange={(e) => persist({ ...draft, entry: { ...draft.entry, negate: e.target.checked } })} />
              NOT (invert)
            </label>
          </div>
          {draft.entry.conditions.map((c, idx) => (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 6 }}>
              <select value={c.indicator} onChange={(e) => updateCondition(idx, { indicator: e.target.value as IndicatorId })} style={input()}>
                {INDICATOR_IDS.map((id) => (
                  <option key={id} value={id}>{INDICATOR_META[id].label} ({INDICATOR_META[id].unit})</option>
                ))}
              </select>
              <select value={c.op} onChange={(e) => updateCondition(idx, { op: e.target.value as Comparator })} style={input()}>
                {COMPARATORS.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <input type="number" value={c.value} onChange={(e) => updateCondition(idx, { value: Number(e.target.value) })} style={input()} step="0.1" />
              <button onClick={() => removeCondition(idx)} style={btnGhost()} aria-label="Remove condition">✕</button>
            </div>
          ))}
          <button onClick={addCondition} style={btnGhost()}>+ Add condition</button>
        </section>

        <section style={panel()}>
          <h2 style={h2()}>4. Action</h2>
          <select value={draft.action.kind} onChange={(e) => persist({ ...draft, action: { kind: e.target.value as Strategy["action"]["kind"] } })} style={input()}>
            <option value="BUY_CALL">BUY CALL</option>
            <option value="BUY_PUT">BUY PUT</option>
            <option value="WAIT">WAIT</option>
            <option value="EXIT">EXIT</option>
          </select>
        </section>

        <section style={panel()}>
          <h2 style={h2()}>5. Risk Rules</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
            <NumInput label="Max Daily Loss %" value={risk.maxDailyLossPct} onChange={(v) => setRisk({ maxDailyLossPct: v })} />
            <NumInput label="Max Trades" value={risk.maxTrades} onChange={(v) => setRisk({ maxTrades: v })} />
            <NumInput label="Risk %" value={risk.riskPct} onChange={(v) => setRisk({ riskPct: v })} />
            <NumInput label="Target %" value={risk.targetPct} onChange={(v) => setRisk({ targetPct: v })} />
            <NumInput label="Stop %" value={risk.stopPct} onChange={(v) => setRisk({ stopPct: v })} />
            <NumInput label="Trailing Stop %" value={risk.trailingStopPct} onChange={(v) => setRisk({ trailingStopPct: v })} />
          </div>
        </section>

        <section style={panel()}>
          <h2 style={h2()}>Preview</h2>
          <pre style={{ background: "rgba(0,0,0,0.35)", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 12, color: C.text }}>
{JSON.stringify(draft, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--eb-muted)" }}>
      <span>{label}</span>
      <input type="number" value={value ?? ""} step="0.1"
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        style={input()} />
    </label>
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
function btnPrimary(): React.CSSProperties {
  return { background: C.accent, color: "#111", border: "none", padding: "8px 12px", borderRadius: 6, fontWeight: 600, cursor: "pointer" };
}
function btnGhost(): React.CSSProperties {
  return { background: "transparent", color: C.text, border: `1px solid ${C.border}`, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 };
}
function chip(): React.CSSProperties {
  return { background: "rgba(255,255,255,0.05)", color: C.text, border: `1px solid ${C.border}`, padding: "6px 10px", borderRadius: 999, cursor: "pointer", fontSize: 12 };
}

// Silence unused import warning
void useMemo;