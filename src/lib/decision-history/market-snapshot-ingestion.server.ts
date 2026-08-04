import { classifyFreshness as classifyDashboardFreshness, isActionableFreshness, type DataQualityStatus } from "@/lib/data-freshness";
import { DEFAULT_FRESHNESS, type ProviderStatus, type QuoteTick } from "@/lib/provider-foundation/types";
import type { IndexQuote } from "@/lib/market.functions";
import { defaultDecisionHistoryRepository } from "./repository";
import { MARKET_SNAPSHOT_METADATA_VERSION } from "./market-snapshots";
import type {
  DecisionMarketSnapshotRecord,
  DecisionMarketSnapshotWriteResult,
  DecisionPersistenceRepository,
  MarketSnapshotDataQuality,
} from "./types";

export type SnapshotIngestionStatus = "STORED" | "DUPLICATE" | "REJECTED" | "UNAVAILABLE";

export interface SnapshotIngestionResult {
  readonly ok: boolean;
  readonly status: SnapshotIngestionStatus;
  readonly snapshot: DecisionMarketSnapshotRecord | null;
  readonly write: DecisionMarketSnapshotWriteResult | null;
  readonly reason: string | null;
}

export interface NormalizedMarketSnapshotInput {
  readonly instrument: string;
  readonly price: number | null;
  readonly observedAt: string;
  readonly sourceTimestamp: string | null;
  readonly providerAlias: string;
  readonly providerStatus: ProviderStatus | "OK" | "DEGRADED" | "DOWN" | "UNKNOWN";
  readonly dataQuality: MarketSnapshotDataQuality;
  readonly freshnessMs: number | null;
  readonly persistedAt: string;
  readonly snapshotId?: string;
  readonly isMock?: boolean;
  readonly isDemo?: boolean;
  readonly isSynthetic?: boolean;
  readonly isFallbackFabricated?: boolean;
}

const FUTURE_TOLERANCE_MS = 60_000;

function safeReason(reason: string): string {
  return reason.replace(/token|secret|authorization|cookie|api[-_]?key/gi, "[REDACTED]").slice(0, 160);
}

function normalizeDataQuality(status: string): MarketSnapshotDataQuality {
  if (status === "LIVE" || status === "FRESH" || status === "DELAYED" || status === "STALE" || status === "INVALID" || status === "UNAVAILABLE") return status;
  return status === "OK" ? "OK" : "INVALID";
}

function supportedInstrument(instrument: string): boolean {
  return instrument.trim().length > 0;
}

function deterministicSnapshotId(input: NormalizedMarketSnapshotInput): string {
  return [input.providerAlias, input.instrument, input.observedAt].join("::");
}

export function buildVerifiedMarketSnapshotCandidate(input: NormalizedMarketSnapshotInput): { readonly snapshot: DecisionMarketSnapshotRecord; readonly reason: string | null } {
  const observedTs = Date.parse(input.observedAt);
  const sourceTs = input.sourceTimestamp == null ? null : Date.parse(input.sourceTimestamp);
  const persistedTs = Date.parse(input.persistedAt);
  const dataQuality = normalizeDataQuality(input.dataQuality);
  const priceValid = input.price != null && Number.isFinite(input.price) && input.price > 0;
  const timestampValid = Number.isFinite(observedTs) && Number.isFinite(persistedTs) && (sourceTs == null || Number.isFinite(sourceTs));
  const sourceNotFuture = sourceTs == null || sourceTs <= persistedTs + FUTURE_TOLERANCE_MS;
  const freshnessOk = input.freshnessMs != null && Number.isFinite(input.freshnessMs) && input.freshnessMs >= 0 && input.freshnessMs <= DEFAULT_FRESHNESS.QUOTES.delayedMaxSec * 1000;
  const providerOk = input.providerStatus === "LIVE" || input.providerStatus === "DELAYED" || input.providerStatus === "OK" || input.providerStatus === "DEGRADED";
  const qualityOk = dataQuality === "OK" || dataQuality === "LIVE" || dataQuality === "FRESH" || dataQuality === "DELAYED";
  const fabricated = input.isMock || input.isDemo || input.isSynthetic || input.isFallbackFabricated;
  const verified = supportedInstrument(input.instrument) && priceValid && timestampValid && sourceNotFuture && freshnessOk && providerOk && qualityOk && !fabricated;
  const reason = verified
    ? null
    : !supportedInstrument(input.instrument)
      ? "Unsupported instrument."
      : !priceValid
        ? "Invalid snapshot price."
        : !timestampValid
          ? "Invalid snapshot timestamp."
          : !sourceNotFuture
            ? "Source timestamp is in the future."
            : !freshnessOk
              ? "Snapshot is stale."
              : !providerOk
                ? "Provider status is not acceptable."
                : !qualityOk
                  ? "Data quality is not acceptable."
                  : "Mock, demo, synthetic, or fallback-fabricated snapshot rejected.";

  return {
    snapshot: {
      snapshotId: input.snapshotId ?? deterministicSnapshotId(input),
      instrument: input.instrument,
      observedAt: input.observedAt,
      price: input.price,
      sourceTimestamp: input.sourceTimestamp,
      providerAlias: input.providerAlias,
      dataQuality,
      freshnessMs: input.freshnessMs,
      verified,
      persistedAt: input.persistedAt,
      metadataVersion: MARKET_SNAPSHOT_METADATA_VERSION,
    },
    reason: reason ? safeReason(reason) : null,
  };
}

export async function ingestVerifiedMarketSnapshot(
  input: NormalizedMarketSnapshotInput,
  repository: Pick<DecisionPersistenceRepository, "recordMarketSnapshot"> = defaultDecisionHistoryRepository,
): Promise<SnapshotIngestionResult> {
  if (!repository.recordMarketSnapshot) return { ok: false, status: "UNAVAILABLE", snapshot: null, write: null, reason: "Market snapshot repository unavailable." };
  const candidate = buildVerifiedMarketSnapshotCandidate(input);
  if (!candidate.snapshot.verified) {
    const write = await repository.recordMarketSnapshot(candidate.snapshot);
    return { ok: false, status: "REJECTED", snapshot: candidate.snapshot, write, reason: candidate.reason };
  }
  const write = await repository.recordMarketSnapshot(candidate.snapshot);
  return {
    ok: write.ok,
    status: write.status === "STORED" || write.status === "DUPLICATE" ? write.status : "REJECTED",
    snapshot: candidate.snapshot,
    write,
    reason: write.reason ?? candidate.reason,
  };
}

export function normalizedInputFromQuoteTick(tick: QuoteTick, persistedAt: string): NormalizedMarketSnapshotInput {
  const sourceTimestamp = tick.telemetry.providerTime ?? tick.telemetry.receivedAt;
  const freshnessMs = Math.max(0, Date.parse(persistedAt) - Date.parse(sourceTimestamp));
  const quality = classifyDashboardFreshness({
    providerTimestamp: sourceTimestamp,
    receivedTimestamp: tick.telemetry.receivedAt,
    expectedUpdateMs: DEFAULT_FRESHNESS.QUOTES.liveMaxSec * 1000,
    providerStatus: tick.telemetry.status === "FAILED" || tick.telemetry.status === "OFFLINE" ? "DOWN" : tick.telemetry.status === "STALE" ? "DEGRADED" : "OK",
    dataQuality: tick.last > 0 ? "OK" : "INVALID",
    now: Date.parse(persistedAt),
  });
  const dataQuality: DataQualityStatus = isActionableFreshness(quality.status) ? "OK" : quality.status === "DELAYED" ? "STALE" : "INVALID";
  return {
    instrument: tick.symbol,
    price: tick.last,
    observedAt: sourceTimestamp,
    sourceTimestamp,
    providerAlias: tick.telemetry.providerId,
    providerStatus: tick.telemetry.status,
    dataQuality,
    freshnessMs,
    persistedAt,
  };
}

export function normalizedInputFromIndexQuote(
  quote: IndexQuote,
  provider: { readonly name: string; readonly status: string; readonly receivedAt: string; readonly providerTime: string | null },
  persistedAt: string,
  instrumentOverride?: string,
): NormalizedMarketSnapshotInput {
  const sourceTimestamp = provider.providerTime ?? provider.receivedAt ?? quote.updatedAt;
  const freshnessMs = Math.max(0, Date.parse(persistedAt) - Date.parse(sourceTimestamp));
  return {
    instrument: instrumentOverride ?? quote.symbol,
    price: quote.livePrice,
    observedAt: sourceTimestamp,
    sourceTimestamp,
    providerAlias: provider.name,
    providerStatus: provider.status as ProviderStatus,
    dataQuality: quote.livePrice > 0 ? "OK" : "INVALID",
    freshnessMs,
    persistedAt,
    isFallbackFabricated: provider.name.includes("fallback"),
  };
}



