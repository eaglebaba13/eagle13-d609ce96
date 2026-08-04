import type { ProviderProvenance } from "@/lib/provider-health-registry";

function toneFor(status: ProviderProvenance["status"]): string {
  switch (status) {
    case "HEALTHY":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "DEGRADED":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "STALE":
      return "border-orange-500/40 bg-orange-500/10 text-orange-300";
    case "RATE_LIMITED":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
    case "AUTH_REQUIRED":
      return "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300";
    default:
      return "border-red-500/40 bg-red-500/10 text-red-300";
  }
}

function humanAge(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.round(sec / 3600)}h`;
}

export function ProvenanceChip({ provenance }: { provenance: ProviderProvenance | null }) {
  if (!provenance) return null;
  const tone = toneFor(provenance.status);
  const title = [
    `Provider: ${provenance.label}`,
    `Status: ${provenance.status}`,
    `Freshness: ${provenance.freshness} (${humanAge(provenance.ageSeconds)})`,
    `Latency: ${provenance.latencyMs}ms`,
    `Quality: ${provenance.qualityScore}/100`,
    `Failover: ${provenance.failoverState}`,
    provenance.cached ? "Cached" : "Live",
    provenance.mock ? "MOCK" : "",
    provenance.lastSuccessAt ? `Last success: ${provenance.lastSuccessAt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span
      title={title}
      data-testid="provenance-chip"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${tone}`}
    >
      <span className="font-semibold uppercase">{provenance.label}</span>
      <span aria-hidden>·</span>
      <span>{provenance.freshness}</span>
      <span aria-hidden>·</span>
      <span>Q{provenance.qualityScore}</span>
      {provenance.mock ? <span className="ml-1 rounded bg-black/40 px-1">MOCK</span> : null}
    </span>
  );
}