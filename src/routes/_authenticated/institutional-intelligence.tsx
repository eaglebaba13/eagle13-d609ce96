// Phase 49 — Institutional Intelligence LIVE dashboard.
// Consumes the deterministic snapshot server function. No fabrication:
// unavailable sub-systems surface honest LIVE / RESEARCH / PROVIDER_PENDING
// / OFFICIAL_SOURCE_REQUIRED status chips.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { getInstitutionalIntelligenceSnapshot } from "@/lib/institutional-intelligence/institutional-intelligence.functions";
import type { LiveStatus } from "@/lib/institutional-intelligence/types";

export const Route = createFileRoute("/_authenticated/institutional-intelligence")({
  head: () => ({
    meta: [
      { title: "Institutional Intelligence · EagleBABA" },
      {
        name: "description",
        content:
          "LIVE institutional intelligence: weighted breadth of the NIFTY50 top-10, NIFTY50 advance/decline, sector rotation, and a deterministic 0-100 score.",
      },
    ],
  }),
  component: InstitutionalIntelligencePage,
});

function statusChipClass(status: LiveStatus): string {
  switch (status) {
    case "LIVE": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "RESEARCH": return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "PROVIDER_PENDING": return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "OFFICIAL_SOURCE_REQUIRED": return "border-purple-500/40 bg-purple-500/10 text-purple-200";
    default: return "border-border/60 bg-muted text-muted-foreground";
  }
}

function StatusChip({ status }: { status: LiveStatus }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusChipClass(status)}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Section({
  id, title, status, reason, children,
}: { id: string; title: string; status: LiveStatus; reason?: string | null; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border/60 p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold text-foreground">{title}</h2>
        <StatusChip status={status} />
      </header>
      {reason && <p className="mt-1 text-[11px] text-muted-foreground">{reason}</p>}
      <div className="mt-2 text-sm text-foreground">{children}</div>
    </section>
  );
}

function InstitutionalIntelligencePage() {
  const fn = useServerFn(getInstitutionalIntelligenceSnapshot);
  const { data, isLoading, error } = useQuery({
    queryKey: ["institutional-intelligence-snapshot"],
    queryFn: () => fn(),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Activity size={20} aria-hidden /> Institutional Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">
          Live institutional context: NIFTY50 top-10 weighted breadth, advance/decline, sector rotation,
          and a deterministic 0–100 score. Analytical only — does not replace the Decision Engine.
        </p>
      </header>

      {isLoading && <div className="text-sm text-muted-foreground">Loading live snapshot…</div>}
      {error && <div className="text-sm text-red-300">Failed to load snapshot: {(error as Error).message}</div>}

      {data && (
        <>
          <section className="rounded-lg border border-border/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Institutional Score</div>
                <div className="mt-1 text-3xl font-bold text-foreground">{data.score.score}/100</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Bias · {data.score.bias.replace(/_/g, " ")} · Confidence {(data.score.confidence * 100).toFixed(0)}%
                </div>
              </div>
              <StatusChip status={data.overallStatus} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{data.score.explanation}</p>
          </section>

          <Section
            id="sec-weighted"
            title="Weighted Breadth (Top-10 NIFTY50)"
            status={data.weightedBreadth.status}
            reason={data.weightedBreadth.reason}
          >
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Positive</div>
                <div className="font-semibold">{data.weightedBreadth.positiveWeightPct}%</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Negative</div>
                <div className="font-semibold">{data.weightedBreadth.negativeWeightPct}%</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Score</div>
                <div className="font-semibold">{data.weightedBreadth.weightedBreadthScore}</div>
              </div>
            </div>
          </Section>

          <Section
            id="sec-n50"
            title="NIFTY50 Breadth"
            status={data.nifty50Breadth.status}
            reason={data.nifty50Breadth.reason}
          >
            <div className="text-sm">
              Advancing {data.nifty50Breadth.advancing} · Declining {data.nifty50Breadth.declining} · Unchanged {data.nifty50Breadth.unchanged} · Breadth {data.nifty50Breadth.breadthPct}%
            </div>
          </Section>

          <Section
            id="sec-sector"
            title="Sector Rotation"
            status={data.sectors.status}
            reason={data.sectors.reason}
          >
            <div className="grid gap-2 md:grid-cols-2 text-sm">
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Leaders</div>
                <ul className="mt-1 space-y-0.5">
                  {data.sectors.leaders.length
                    ? data.sectors.leaders.map((r) => (
                        <li key={r.id}>{r.label}: {(r.changePct ?? 0).toFixed(2)}%</li>
                      ))
                    : <li className="text-muted-foreground">—</li>}
                </ul>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Laggards</div>
                <ul className="mt-1 space-y-0.5">
                  {data.sectors.laggards.length
                    ? data.sectors.laggards.map((r) => (
                        <li key={r.id}>{r.label}: {(r.changePct ?? 0).toFixed(2)}%</li>
                      ))
                    : <li className="text-muted-foreground">—</li>}
                </ul>
              </div>
            </div>
          </Section>

          <Section
            id="sec-flow"
            title="Institutional Flow (FII / DII)"
            status={data.flow.status}
            reason={data.flow.reason}
          >
            {data.flow.status === "LIVE"
              ? <>FII: {data.flow.fiiNet} · DII: {data.flow.diiNet} · Date: {data.flow.tradeDate}</>
              : <span className="text-muted-foreground">Awaiting validated official source.</span>}
          </Section>

          <Section
            id="sec-news"
            title="News Sentiment"
            status={data.news.status}
            reason={data.news.reason}
          >
            {data.news.status === "LIVE"
              ? <>+{data.news.positive} · ~{data.news.neutral} · -{data.news.negative} · Impact {data.news.marketImpact}</>
              : <span className="text-muted-foreground">Awaiting validated news provider.</span>}
          </Section>

          <p className="text-[11px] text-muted-foreground">
            Snapshot generated at {data.generatedAt}. Analytical only — never trading advice.
          </p>
        </>
      )}
    </div>
  );
}