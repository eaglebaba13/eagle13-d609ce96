import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  computeDecisionOverlay,
  computePositionSize,
  computeRiskReport,
  DEFAULT_LIMITS,
  demoPortfolio,
  evaluateAlerts,
  makeAlert,
} from "@/lib/portfolio-manager";
import type { LocalAlert, PortfolioState } from "@/lib/portfolio-manager";
import { getContractLotSize } from "@/lib/contracts";

const C = {
  bg: "var(--eb-bg)", card: "var(--eb-card)", border: "var(--eb-border)",
  text: "var(--eb-text)", muted: "var(--eb-muted)", accent: "var(--eb-accent)",
  bull: "var(--eb-bull)", bear: "var(--eb-bear)",
};

export const Route = createFileRoute("/risk-center")({
  component: RiskCenterPage,
  head: () => ({
    meta: [
      { title: "Risk Center | EagleBABA" },
      { name: "description", content: "Position sizing calculator, portfolio risk report, AI decision overlay and local alerts." },
      { property: "og:title", content: "Risk Center | EagleBABA" },
      { property: "og:description", content: "Manage portfolio risk with deterministic sizing and alert engines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STORAGE_KEY = "eb:portfolio-demo";
const ALERTS_KEY = "eb:local-alerts";
const DEFAULT_RISK_INSTRUMENT = "NIFTY";
const DEFAULT_RISK_LOT_SIZE = getContractLotSize(DEFAULT_RISK_INSTRUMENT).lotSize;

function loadState(): PortfolioState {
  if (typeof window === "undefined") return demoPortfolio;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoPortfolio;
    const parsed = JSON.parse(raw) as PortfolioState;
    if (!parsed || !Array.isArray(parsed.positions)) return demoPortfolio;
    return parsed;
  } catch { return demoPortfolio; }
}
function loadAlerts(): LocalAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalAlert[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function RiskCenterPage() {
  const [state, setState] = useState<PortfolioState>(() => demoPortfolio);
  const [alerts, setAlerts] = useState<LocalAlert[]>([]);
  useEffect(() => { setState(loadState()); setAlerts(loadAlerts()); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch { /* ignore */ }
  }, [alerts]);

  const risk = useMemo(() => computeRiskReport(state, DEFAULT_LIMITS), [state]);

  // Position sizing form
  const [capital, setCapital] = useState(500000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(24000);
  const [stop, setStop] = useState(23950);
  const [lotSize, setLotSize] = useState(DEFAULT_RISK_LOT_SIZE ?? 0);
  const sizing = useMemo(() => computePositionSize({ capital, riskPct, entry, stopLoss: stop, lotSize }), [capital, riskPct, entry, stop, lotSize]);

  // Decision overlay
  const [action, setAction] = useState<"BUY_CALL" | "BUY_PUT" | "WAIT">("BUY_CALL");
  const overlay = useMemo(() => computeDecisionOverlay({
    action, entry, stopLoss: stop, capital, riskPct, currentRiskPct: risk.portfolioRiskPct,
  }), [action, entry, stop, capital, riskPct, risk.portfolioRiskPct]);

  // Alerts form
  const [alertKind, setAlertKind] = useState<LocalAlert["kind"]>("PCR_THRESHOLD");
  const [alertThreshold, setAlertThreshold] = useState(1.2);
  const [alertDir, setAlertDir] = useState<"ABOVE" | "BELOW">("ABOVE");

  const addAlert = () => {
    const id = `al-${Date.now()}`;
    const msg = `${alertKind} ${alertDir} ${alertThreshold}`;
    setAlerts((prev) => [...prev, makeAlert(id, alertKind, { threshold: alertThreshold, direction: alertDir, message: msg })]);
  };
  const removeAlert = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));
  const dryRun = () => {
    const { next, triggered } = evaluateAlerts(alerts, {
      previousAiDecisionAction: "WAIT", aiDecisionAction: action,
      previousInstitutionalScore: 50, institutionalScore: 65,
      pcr: 1.25, vix: 14,
    });
    setAlerts([...next]);
    if (typeof window !== "undefined") window.alert(`Triggered: ${triggered.length}`);
  };

  const cellCard: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 };
  const inp: React.CSSProperties = { width: "100%", background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", fontSize: 13 };

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: "1rem" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Risk Center</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/portfolio" style={{ color: C.accent, fontSize: 13 }}>Portfolio â†’</Link>
            <Link to="/watchlist" style={{ color: C.accent, fontSize: 13 }}>Watchlist â†’</Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <div style={cellCard}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Portfolio Risk</div>
            <div style={{ fontSize: 13 }}>Level: <b style={{ color: risk.level === "CRITICAL" ? C.bear : risk.level === "HIGH" ? C.accent : C.bull }}>{risk.level}</b></div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              Risk {risk.portfolioRiskPct.toFixed(2)}% Â· Exposure {risk.exposurePct.toFixed(1)}%<br/>
              Daily Loss {risk.dailyLossPct.toFixed(2)}% Â· Weekly Loss {risk.weeklyLossPct.toFixed(2)}%<br/>
              Max Drawdown {risk.maxDrawdownPct.toFixed(2)}%
            </div>
            {risk.breaches.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 16, color: C.bear, fontSize: 12 }}>
                {risk.breaches.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </div>

          <div style={cellCard}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Position Sizing Calculator</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
              <label>Capital<input type="number" value={capital} onChange={(e) => setCapital(+e.target.value)} style={inp} /></label>
              <label>Risk %<input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(+e.target.value)} style={inp} /></label>
              <label>Entry<input type="number" value={entry} onChange={(e) => setEntry(+e.target.value)} style={inp} /></label>
              <label>Stop Loss<input type="number" value={stop} onChange={(e) => setStop(+e.target.value)} style={inp} /></label>
              <label>Lot Size<input type="number" value={lotSize} onChange={(e) => setLotSize(+e.target.value)} style={inp} /></label>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: sizing.valid ? C.text : C.bear }}>
              {sizing.valid ? (
                <>Recommended Qty: <b>{sizing.recommendedQuantity}</b> ({sizing.lots} lots) Â· Max Alloc: â‚¹{sizing.maxCapitalAllocation.toLocaleString("en-IN")} Â· Max Loss: â‚¹{sizing.maxLoss.toLocaleString("en-IN")}</>
              ) : (
                <>Invalid: {sizing.reason}</>
              )}
            </div>
          </div>

          <div style={cellCard}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>AI Decision Overlay</div>
            <label style={{ fontSize: 12 }}>Action
              <select value={action} onChange={(e) => setAction(e.target.value as "BUY_CALL" | "BUY_PUT" | "WAIT")} style={inp}>
                <option value="BUY_CALL">BUY CALL</option>
                <option value="BUY_PUT">BUY PUT</option>
                <option value="WAIT">WAIT</option>
              </select>
            </label>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Capital Required: â‚¹{overlay.capitalRequired.toLocaleString("en-IN")}<br/>
              Suggested Qty: {overlay.suggestedQuantity}<br/>
              Max Loss: â‚¹{overlay.maxLoss.toLocaleString("en-IN")}<br/>
              Portfolio Impact: {overlay.portfolioImpactPct.toFixed(2)}%<br/>
              Risk Level: <b style={{ color: overlay.riskLevel === "CRITICAL" ? C.bear : overlay.riskLevel === "HIGH" ? C.accent : C.bull }}>{overlay.riskLevel}</b>
            </div>
            {overlay.warnings.length > 0 && (
              <ul style={{ marginTop: 6, paddingLeft: 16, color: C.bear, fontSize: 12 }}>
                {overlay.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>

          <div style={cellCard}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Local Alerts</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
              <label>Kind
                <select value={alertKind} onChange={(e) => setAlertKind(e.target.value as LocalAlert["kind"])} style={inp}>
                  <option value="AI_DECISION_CHANGED">AI Decision Changed</option>
                  <option value="INSTITUTIONAL_SCORE_CHANGED">Institutional Score Changed</option>
                  <option value="PCR_THRESHOLD">PCR Threshold</option>
                  <option value="VIX_THRESHOLD">VIX Threshold</option>
                  <option value="STOP_LOSS_HIT">Stop Loss Hit (manual)</option>
                  <option value="TARGET_HIT">Target Hit (manual)</option>
                </select>
              </label>
              <label>Threshold<input type="number" step="0.1" value={alertThreshold} onChange={(e) => setAlertThreshold(+e.target.value)} style={inp} /></label>
              <label>Direction
                <select value={alertDir} onChange={(e) => setAlertDir(e.target.value as "ABOVE" | "BELOW")} style={inp}>
                  <option value="ABOVE">Above</option>
                  <option value="BELOW">Below</option>
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "end", gap: 6 }}>
                <button onClick={addAlert} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 12 }}>Add</button>
                <button onClick={dryRun} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, borderRadius: 4, padding: "4px 10px", fontSize: 12 }}>Dry Run</button>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {alerts.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No alerts configured.</div>}
              {alerts.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, borderTop: `1px solid ${C.border}`, padding: "4px 0" }}>
                  <span>{a.kind} {a.direction ?? ""} {a.threshold ?? ""}{a.triggeredAt ? " Â· TRIGGERED" : ""}</span>
                  <button onClick={() => removeAlert(a.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11 }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, color: C.muted, fontSize: 11 }}>
          Local alerts and demo positions are stored in your browser only. This module does not modify live trading engines.
        </div>
      </div>
    </div>
  );
}


