// Phase 53B — Provider Health status console. Read-only surface driven by
// the in-process provider-health registry. No secrets rendered.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listProviderHealth,
  type ProviderHealthSnapshot,
} from "@/lib/provider-health-registry";

export const Route = createFileRoute("/_authenticated/admin/provider-health")({
  head: () => ({
    meta: [
      { title: "Provider Health — EagleBABA" },
      {
        name: "description",
        content:
          "Live status, freshness, latency and quality of every registered market-data provider.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ProviderHealthPage,
});

function toneFor(code: ProviderHealthSnapshot["code"]): string {
  switch (code) {
    case "HEALTHY":
      return "text-emerald-400";
    case "DEGRADED":
      return "text-amber-400";
    case "STALE":
      return "text-orange-400";
    case "RATE_LIMITED":
      return "text-yellow-400";
    case "AUTH_REQUIRED":
      return "text-fuchsia-400";
    default:
      return "text-red-400";
  }
}

function humanAge(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.round(sec / 3600)}h`;
}

function ProviderHealthPage() {
  const [rows, setRows] = useState<ProviderHealthSnapshot[]>(() => listProviderHealth());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setRows(listProviderHealth());
  }, [tick]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Provider Health</h1>
        <p className="text-sm text-muted-foreground">
          Live status of every registered market-data provider. Auto-refreshes every 5 seconds.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No providers have reported yet. Values appear here after the first live fetch.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border/40 bg-card/40 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Freshness</th>
                  <th className="px-3 py-2">Latency</th>
                  <th className="px-3 py-2">Quality</th>
                  <th className="px-3 py-2">Success</th>
                  <th className="px-3 py-2">Failures</th>
                  <th className="px-3 py-2">Last Success</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.providerId} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className={`px-3 py-2 font-semibold ${toneFor(r.code)}`}>{r.code}</td>
                    <td className="px-3 py-2">
                      {r.freshness} · {humanAge(r.ageSeconds)}
                    </td>
                    <td className="px-3 py-2">{r.latencyMs}ms</td>
                    <td className="px-3 py-2">{r.qualityScore}/100</td>
                    <td className="px-3 py-2">{Math.round(r.successRate * 100)}%</td>
                    <td className="px-3 py-2">{r.failureCount}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.lastSuccessAt ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((r) => (
              <div key={r.providerId} className="rounded-lg border border-border/40 bg-card/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.label}</div>
                  <div className={`text-xs font-semibold ${toneFor(r.code)}`}>{r.code}</div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <dt>Freshness</dt>
                  <dd>
                    {r.freshness} · {humanAge(r.ageSeconds)}
                  </dd>
                  <dt>Latency</dt>
                  <dd>{r.latencyMs}ms</dd>
                  <dt>Quality</dt>
                  <dd>{r.qualityScore}/100</dd>
                  <dt>Success</dt>
                  <dd>{Math.round(r.successRate * 100)}%</dd>
                  <dt>Failures</dt>
                  <dd>{r.failureCount}</dd>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}