import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReleaseMetadata, RELEASE_VERDICT } from "@/lib/release-metadata";
import {
  getSupabaseEnvReadiness,
  type SupabaseEnvEntry,
} from "@/lib/release-metadata/supabase-env-readiness.functions";

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: "System Status | EagleBABA" },
      { name: "description", content: "EagleBABA public system status summary." },
      { property: "og:title", content: "System Status | EagleBABA" },
      { property: "og:description", content: "Public system status summary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StatusPage() {
  const m = getReleaseMetadata();
  const channelLabel = m.channel === "NOT INJECTED" ? "CLOSED_BETA" : m.channel;
  const rows: [string, string][] = [
    ["Application version", m.version],
    ["Build ID", m.buildId],
    ["Git commit", m.commitSha],
    ["Build timestamp", m.deployedAt],
    ["Environment", m.environment],
    ["Release channel", channelLabel],
    ["Readiness verdict", RELEASE_VERDICT],
  ];

  const envFn = useServerFn(getSupabaseEnvReadiness);
  const { data: env, isLoading: envLoading, error: envError } = useQuery({
    queryKey: ["supabase-env-readiness"],
    queryFn: () => envFn(),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">System Status</h1>
      <p className="text-muted-foreground">
        Live health, provider status, and readiness details are available to signed-in
        administrators at <code className="rounded bg-muted px-1 py-0.5">/admin/system-status</code>.
        This public page summarises platform posture and current release provenance.
      </p>
      <section aria-label="Release provenance" className="rounded-lg border border-border/60 bg-card/40 p-4">
        <h2 className="mb-3 text-base font-semibold">Release provenance</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="break-all font-mono text-xs text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-label="Supabase environment readiness"
        className="rounded-lg border border-border/60 bg-card/40 p-4"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Supabase environment readiness</h2>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Channel · {env?.channel ?? channelLabel}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Presence-only report. Values, keys, and project references are never returned.
        </p>
        {envLoading && <p className="text-xs text-muted-foreground">Checking environment…</p>}
        {envError && (
          <p className="text-xs text-red-400">
            Unable to read environment readiness right now.
          </p>
        )}
        {env && (
          <>
            <p className="mb-3 text-xs">
              Overall:{" "}
              <span
                className={
                  env.allRequiredPresent
                    ? "font-semibold text-emerald-400"
                    : "font-semibold text-amber-400"
                }
              >
                {env.allRequiredPresent ? "All required variables present" : "Missing required variables"}
              </span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="border-b border-border/60 py-1.5 pr-3 font-medium">Variable</th>
                    <th className="border-b border-border/60 py-1.5 pr-3 font-medium">Scope</th>
                    <th className="border-b border-border/60 py-1.5 pr-3 font-medium">Status</th>
                    <th className="border-b border-border/60 py-1.5 font-medium">Used for</th>
                  </tr>
                </thead>
                <tbody>
                  {env.entries.map((e: SupabaseEnvEntry) => (
                    <tr key={e.name} className="align-top">
                      <td className="border-b border-border/40 py-1.5 pr-3 font-mono">{e.name}</td>
                      <td className="border-b border-border/40 py-1.5 pr-3">{e.scope}</td>
                      <td className="border-b border-border/40 py-1.5 pr-3">
                        {e.present ? (
                          <span className="text-emerald-400">present</span>
                        ) : e.required ? (
                          <span className="text-red-400">missing</span>
                        ) : (
                          <span className="text-muted-foreground">optional</span>
                        )}
                      </td>
                      <td className="border-b border-border/40 py-1.5 text-muted-foreground">{e.usedFor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Checked at {env.checkedAt}.
            </p>
          </>
        )}
      </section>

      <ul className="list-disc space-y-1 pl-6">
        <li>Platform: v1.0-RC1 (release candidate)</li>
        <li>Live order execution: disabled</li>
        <li>Broker execution: disabled</li>
        <li>CoinDCX trading: disabled (market data only)</li>
        <li>Billing: manual UPI verification</li>
      </ul>
      <p className="text-xs text-muted-foreground">Incidents and provider outages are recorded in observability diagnostics; see admin console for details.</p>
    </article>
  );
}