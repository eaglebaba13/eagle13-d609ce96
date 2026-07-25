import { createFileRoute } from "@tanstack/react-router";
import { getReleaseMetadata, RELEASE_VERDICT } from "@/lib/release-metadata";

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
  const rows: [string, string][] = [
    ["Application version", m.version],
    ["Build ID", m.buildId],
    ["Git commit", m.commitSha],
    ["Build timestamp", m.deployedAt],
    ["Environment", m.environment],
    ["Release channel", m.channel === "NOT INJECTED" ? "CLOSED_BETA" : m.channel],
    ["Readiness verdict", RELEASE_VERDICT],
  ];
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