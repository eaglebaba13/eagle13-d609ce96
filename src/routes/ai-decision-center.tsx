import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { useHydrated } from "@/hooks/use-hydrated";
import { getGtiAiDecisionSnapshot, type GtiAiDecisionSnapshot } from "@/lib/gti-ai-decision/gti-ai-decision.functions";

const C = {
  bg: "var(--eb-bg)",
  card: "var(--eb-card)",
  border: "var(--eb-border)",
  green: "var(--eb-bull)",
  red: "var(--eb-bear)",
  gold: "var(--eb-accent)",
  blue: "var(--eb-blue)",
  text: "var(--eb-text)",
  muted: "var(--eb-muted)",
};

const REFRESH_MS = 30_000;

const snapQuery = () =>
  queryOptions({
    queryKey: ["gti-ai-decision-snapshot"],
    queryFn: () => getGtiAiDecisionSnapshot(),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

export const Route = createFileRoute("/ai-decision-center")({
  component: AiDecisionCenter,
  head: () => ({
    meta: [
      { title: "AI Decision Center | EagleBABA" },
      {
        name: "description",
        content:
          "GTI AI Decision Engine — deterministic institutional recommendation combining Astro, Gann, GTI, PCR, Options, Institutional Intelligence, VIX, Breadth and Sector Rotation into one explainable BUY CALL / BUY PUT / WAIT signal.",
      },
      { property: "og:title", content: "AI Decision Center | EagleBABA" },
      {
        property: "og:description",
        content:
          "Single deterministic AI recommendation, confidence, trade quality, reasons and risk plan derived from validated EagleBABA engines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapQuery());
  },
});

function AiDecisionCenter() {
  const { data } = useSuspenseQuery(snapQuery());
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, padding: "1rem" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <style>{`
          .gti-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
          .gti-2col { display:grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap: 1rem; }
          @media (max-width: 960px){ .gti-2col{ grid-template-columns: 1fr; } }
        `}</style>
        <Header snap={data} />
        <SummaryCards snap={data} />
        <div className="gti-2col">
          <ReasonsPanel snap={data} />
          <RiskPanel snap={data} />
        </div>
        <TimelinePanel snap={data} />
        <TelegramPreview snap={data} />
        <Footer snap={data} />
      </div>
    </div>
  );
}

function actionColor(a: string): string {
  if (a === "BUY_CALL") return C.green;
  if (a === "BUY_PUT") return C.red;
  return C.muted;
}
function actionLabel(a: string): string {
  if (a === "BUY_CALL") return "BUY CALL";
  if (a === "BUY_PUT") return "BUY PUT";
  return "WAIT";
}
function qualityColor(q: string): string {
  if (q === "EXCELLENT") return C.green;
  if (q === "GOOD") return C.blue;
  if (q === "AVERAGE") return C.gold;
  return C.red;
}
function riskColor(r: string): string {
  if (r === "LOW") return C.green;
  if (r === "MEDIUM") return C.gold;
  return C.red;
}

function Header({ snap }: { snap: GtiAiDecisionSnapshot }) {
  const hydrated = useHydrated();
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
      <div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>AI Decision Center</div>
        <div style={{ fontSize: "0.85rem", color: C.muted }}>
          {snap.upstream.symbol} · {snap.upstream.marketOpen ? "Market Open" : "Market Closed"} ·
          {" "}Generated {hydrated ? new Date(snap.generatedAt).toLocaleTimeString() : "—"}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link to="/decision" style={linkBtn}>Decision Engine</Link>
        <Link to="/institutional-intelligence" style={linkBtn}>Institutional →</Link>
      </div>
    </header>
  );
}

const linkBtn: React.CSSProperties = {
  padding: "0.4rem 0.75rem",
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: C.text,
  textDecoration: "none",
  fontSize: "0.85rem",
};

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.75rem 1rem" }}>
      <div style={{ fontSize: "0.7rem", letterSpacing: 0.6, color: C.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function SummaryCards({ snap }: { snap: GtiAiDecisionSnapshot }) {
  const d = snap.decision;
  return (
    <div className="gti-grid">
      <Card label="Recommendation">
        <div style={{ fontSize: "1.5rem", fontWeight: 900, color: actionColor(d.action) }}>{actionLabel(d.action)}</div>
        <div style={{ fontSize: "0.75rem", color: C.muted }}>{d.confidenceBand.replace("_", " ")}</div>
      </Card>
      <Card label="Confidence">
        <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{Math.round(d.confidence)}%</div>
        <div style={{ height: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
          <div style={{ width: `${d.confidence}%`, height: "100%", background: actionColor(d.action) }} />
        </div>
      </Card>
      <Card label="Trade Quality">
        <div style={{ fontSize: "1.3rem", fontWeight: 800, color: qualityColor(d.tradeQuality) }}>
          {d.tradeQuality[0] + d.tradeQuality.slice(1).toLowerCase()}
        </div>
      </Card>
      <Card label="Institutional Score">
        <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{d.institutionalScore}/100</div>
      </Card>
      <Card label="Data Freshness">
        <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          {d.timeline.dataFreshnessSec != null ? `${d.timeline.dataFreshnessSec}s` : "—"}
        </div>
        <div style={{ fontSize: "0.75rem", color: C.muted }}>VIX {snap.upstream.vix != null ? snap.upstream.vix.toFixed(2) : "—"}</div>
      </Card>
    </div>
  );
}

function ReasonsPanel({ snap }: { snap: GtiAiDecisionSnapshot }) {
  const d = snap.decision;
  return (
    <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem" }}>
      <SectionTitle>Reasons</SectionTitle>
      {d.reasons.length === 0 ? (
        <div style={{ color: C.muted, fontSize: "0.85rem" }}>No deterministic reasons available.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: "0.9rem" }}>
          {d.reasons.map((r) => (
            <li key={r.key} style={{ padding: "0.4rem 0", borderTop: `1px solid ${C.border}`, display: "flex", gap: "0.6rem" }}>
              <span style={{ color: r.polarity === "BULL" ? C.green : r.polarity === "BEAR" ? C.red : C.muted, fontWeight: 800 }}>
                {r.polarity === "BULL" ? "✓" : r.polarity === "BEAR" ? "✓" : "•"}
              </span>
              <span>
                <strong>{r.label}</strong>
                <span style={{ color: C.muted }}> — {r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {d.warnings.length > 0 && (
        <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: C.gold }}>
          {d.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
    </section>
  );
}

function RiskPanel({ snap }: { snap: GtiAiDecisionSnapshot }) {
  const r = snap.decision.risk;
  return (
    <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem" }}>
      <SectionTitle>Risk Plan</SectionTitle>
      <div style={{ fontSize: "1.2rem", fontWeight: 900, color: riskColor(r.level) }}>{r.level} RISK</div>
      {r.unavailableReason ? (
        <div style={{ marginTop: "0.5rem", color: C.muted, fontSize: "0.85rem" }}>{r.unavailableReason}</div>
      ) : (
        <table style={{ width: "100%", fontSize: "0.85rem", marginTop: "0.5rem", borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={td}>Entry Zone</td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{r.entryZone!.low} – {r.entryZone!.high}</td></tr>
            <tr><td style={td}>Stop Loss</td><td style={{ ...td, textAlign: "right", color: C.red, fontWeight: 700 }}>{r.stopLoss}</td></tr>
            <tr><td style={td}>Target 1</td><td style={{ ...td, textAlign: "right", color: C.green, fontWeight: 700 }}>{r.target1}</td></tr>
            <tr><td style={td}>Target 2</td><td style={{ ...td, textAlign: "right", color: C.green, fontWeight: 700 }}>{r.target2}</td></tr>
          </tbody>
        </table>
      )}
      <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: C.muted }}>
        {r.notes.join(" · ")}
      </div>
    </section>
  );
}

function TimelinePanel({ snap }: { snap: GtiAiDecisionSnapshot }) {
  const t = snap.decision.timeline;
  const hydrated = useHydrated();
  const fmt = (iso: string | null) =>
    iso && hydrated ? new Date(iso).toLocaleTimeString() : "—";
  return (
    <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem", marginTop: "1rem" }}>
      <SectionTitle>Decision Timeline</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", fontSize: "0.9rem" }}>
        <div><div style={mutedLbl}>Previous</div><div>{t.previousAction ? actionLabel(t.previousAction) : "—"}</div><div style={{ color: C.muted, fontSize: "0.75rem" }}>{fmt(t.previousGeneratedAt)}</div></div>
        <div><div style={mutedLbl}>Current</div><div style={{ color: actionColor(t.currentAction), fontWeight: 800 }}>{actionLabel(t.currentAction)}</div><div style={{ color: C.muted, fontSize: "0.75rem" }}>{fmt(t.currentGeneratedAt)}</div></div>
        <div><div style={mutedLbl}>Changed?</div><div style={{ color: t.decisionChanged ? C.gold : C.muted, fontWeight: 700 }}>{t.decisionChanged ? "YES" : "No"}</div></div>
        <div><div style={mutedLbl}>Data Freshness</div><div>{t.dataFreshnessSec != null ? `${t.dataFreshnessSec}s` : "—"}</div></div>
      </div>
    </section>
  );
}

function TelegramPreview({ snap }: { snap: GtiAiDecisionSnapshot }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "1rem", marginTop: "1rem" }}>
      <SectionTitle>Telegram Signal Preview</SectionTitle>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.85rem", color: C.text }}>
        {snap.telegramMessage}
      </pre>
    </section>
  );
}

function Footer({ snap }: { snap: GtiAiDecisionSnapshot }) {
  return (
    <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: C.muted, textAlign: "center" }}>
      {snap.decision.disclaimer}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", letterSpacing: 0.6, textTransform: "uppercase", color: C.muted }}>{children}</h2>;
}

const td: React.CSSProperties = { padding: "0.35rem 0", borderTop: `1px solid ${C.border}` };
const mutedLbl: React.CSSProperties = { fontSize: "0.7rem", letterSpacing: 0.5, textTransform: "uppercase", color: C.muted, marginBottom: 2 };