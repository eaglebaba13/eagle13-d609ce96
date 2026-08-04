import { describe, expect, it } from "vitest";
import { selectHistoricalAccuracyFromOutcomes } from "@/lib/decision/historical-accuracy-adapter";
import { replayUnavailableFromDecisionHistory } from "@/lib/decision/replay-adapter";
import { InMemoryDecisionHistoryRepository } from "./repository";
import { runOutcomeScheduler } from "./outcome-scheduler";
import { findSchedulerVerifiedSnapshot } from "./market-snapshots";
import { buildVerifiedMarketSnapshotCandidate, ingestVerifiedMarketSnapshot, normalizedInputFromQuoteTick } from "./market-snapshot-ingestion.server";
import type { DecisionMarketSnapshotRecord, DecisionPersistedRecord } from "./types";
import type { QuoteTick } from "@/lib/provider-foundation/types";

const NOW = "2026-07-30T09:45:00.000Z";

function decision(over: Partial<DecisionPersistedRecord> = {}): DecisionPersistedRecord {
  return {
    runId: over.runId ?? "snapshot-run-1",
    timestamp: over.timestamp ?? "2026-07-30T09:15:00.000Z",
    instrument: over.instrument ?? "NIFTY50",
    spot: over.spot ?? 24000,
    decision: over.decision ?? "BUY_CE",
    confidence: over.confidence ?? 80,
    risk: over.risk ?? { level: "MEDIUM", reasons: [] },
    signals: over.signals ?? [],
    capabilities: over.capabilities ?? {},
    summary: over.summary ?? { evaluationHorizon: "30m" },
    formulaVersions: over.formulaVersions ?? { decision: "decision@1.0.0" },
    providerLabels: over.providerLabels ?? { market: "UPSTOX" },
  };
}

function snapshot(over: Partial<DecisionMarketSnapshotRecord> = {}): DecisionMarketSnapshotRecord {
  return {
    snapshotId: over.snapshotId ?? "upstox::NIFTY50::2026-07-30T09:45:00.000Z",
    instrument: over.instrument ?? "NIFTY50",
    observedAt: over.observedAt ?? "2026-07-30T09:45:00.000Z",
    price: over.price ?? 24080,
    sourceTimestamp: over.sourceTimestamp ?? "2026-07-30T09:45:00.000Z",
    providerAlias: over.providerAlias ?? "upstox-historical-v1",
    dataQuality: over.dataQuality ?? "OK",
    freshnessMs: over.freshnessMs ?? 0,
    verified: over.verified ?? true,
    persistedAt: over.persistedAt ?? NOW,
    metadataVersion: over.metadataVersion ?? "DECISION_MARKET_SNAPSHOT_V1",
  };
}

describe("verified market snapshot repository", () => {
  it("records valid verified snapshots immutably", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    expect((await repo.recordMarketSnapshot(snapshot())).status).toBe("STORED");
    const stored = repo.getMarketSnapshot("upstox::NIFTY50::2026-07-30T09:45:00.000Z");
    expect(stored?.verified).toBe(true);
    expect(() => {
      (stored as { price: number }).price = 1;
    }).toThrow();
  });

  it("rejects invalid price, future timestamp, stale, and synthetic candidates", () => {
    expect(buildVerifiedMarketSnapshotCandidate({
      instrument: "NIFTY50", price: -1, observedAt: NOW, sourceTimestamp: NOW, providerAlias: "upstox", providerStatus: "LIVE", dataQuality: "OK", freshnessMs: 0, persistedAt: NOW,
    }).snapshot.verified).toBe(false);
    expect(buildVerifiedMarketSnapshotCandidate({
      instrument: "NIFTY50", price: 1, observedAt: NOW, sourceTimestamp: "2026-07-30T09:47:01.000Z", providerAlias: "upstox", providerStatus: "LIVE", dataQuality: "OK", freshnessMs: 0, persistedAt: NOW,
    }).reason).toMatch(/future/i);
    expect(buildVerifiedMarketSnapshotCandidate({
      instrument: "NIFTY50", price: 1, observedAt: NOW, sourceTimestamp: NOW, providerAlias: "upstox", providerStatus: "LIVE", dataQuality: "OK", freshnessMs: 901_000, persistedAt: NOW,
    }).reason).toMatch(/stale/i);
    expect(buildVerifiedMarketSnapshotCandidate({
      instrument: "NIFTY50", price: 1, observedAt: NOW, sourceTimestamp: NOW, providerAlias: "upstox", providerStatus: "LIVE", dataQuality: "OK", freshnessMs: 0, persistedAt: NOW, isSynthetic: true,
    }).reason).toMatch(/synthetic/i);
  });

  it("handles duplicate and conflicting writes deterministically", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    expect((await repo.recordMarketSnapshot(snapshot())).status).toBe("STORED");
    expect((await repo.recordMarketSnapshot(snapshot())).status).toBe("DUPLICATE");
    expect((await repo.recordMarketSnapshot(snapshot({ price: 24100 }))).status).toBe("CONFLICT");
  });

  it("retains bounded snapshots in insertion order", async () => {
    const repo = new InMemoryDecisionHistoryRepository(10, 10, 2);
    for (let i = 0; i < 3; i++) {
      await repo.recordMarketSnapshot(snapshot({ snapshotId: `s${i}`, observedAt: `2026-07-30T09:4${i}:00.000Z`, sourceTimestamp: `2026-07-30T09:4${i}:00.000Z` }));
    }
    expect(repo.listMarketSnapshots().map((item) => item.snapshotId)).toEqual(["s1", "s2"]);
  });

  it("finds exact and nearest verified snapshots at or after the evaluation timestamp", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.recordMarketSnapshot(snapshot({ snapshotId: "before", observedAt: "2026-07-30T09:44:59.000Z", sourceTimestamp: "2026-07-30T09:44:59.000Z" }));
    await repo.recordMarketSnapshot(snapshot({ snapshotId: "exact", observedAt: "2026-07-30T09:45:00.000Z", sourceTimestamp: "2026-07-30T09:45:00.000Z" }));
    await repo.recordMarketSnapshot(snapshot({ snapshotId: "after", observedAt: "2026-07-30T09:45:30.000Z", sourceTimestamp: "2026-07-30T09:45:30.000Z" }));
    expect(repo.findVerifiedSnapshot({ instrument: "NIFTY50", evaluationTimestamp: NOW, maximumAllowedDistanceMs: 60_000 })?.snapshotId).toBe("exact");

    const repo2 = new InMemoryDecisionHistoryRepository();
    await repo2.recordMarketSnapshot(snapshot({ snapshotId: "after-b", observedAt: "2026-07-30T09:45:30.000Z", sourceTimestamp: "2026-07-30T09:45:30.000Z" }));
    await repo2.recordMarketSnapshot(snapshot({ snapshotId: "after-a", observedAt: "2026-07-30T09:45:30.000Z", sourceTimestamp: "2026-07-30T09:45:30.000Z" }));
    expect(repo2.findVerifiedSnapshot({ instrument: "NIFTY50", evaluationTimestamp: NOW, maximumAllowedDistanceMs: 60_000 })?.snapshotId).toBe("after-a");
  });

  it("rejects snapshots before evaluation timestamp and provider alias mismatches", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.recordMarketSnapshot(snapshot({ snapshotId: "before", observedAt: "2026-07-30T09:44:59.000Z", sourceTimestamp: "2026-07-30T09:44:59.000Z" }));
    expect(repo.findVerifiedSnapshot({ instrument: "NIFTY50", evaluationTimestamp: NOW, maximumAllowedDistanceMs: 60_000 })).toBeNull();
    await repo.recordMarketSnapshot(snapshot({ snapshotId: "after", providerAlias: "upstox" }));
    expect(repo.findVerifiedSnapshot({ instrument: "NIFTY50", evaluationTimestamp: NOW, maximumAllowedDistanceMs: 60_000, providerAlias: "nse" })).toBeNull();
  });

  it("ingests normalized QuoteTick without raw provider payload persistence or secrets", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    const tick: QuoteTick = {
      symbol: "NIFTY50",
      last: 24080,
      open: null,
      high: null,
      low: null,
      prevClose: null,
      change: null,
      changePct: null,
      volume: null,
      currency: "INR",
      telemetry: { status: "LIVE", latencyMs: 5, receivedAt: NOW, providerTime: NOW, marketSession: "REGULAR", rateLimit: null, retryAfterMs: null, staleReason: null, providerId: "upstox-historical-v1", role: "PRIMARY" },
    };
    const result = await ingestVerifiedMarketSnapshot(normalizedInputFromQuoteTick(tick, NOW), repo);
    expect(result.status).toBe("STORED");
    const stored = repo.listMarketSnapshots()[0];
    expect(JSON.stringify(stored)).not.toMatch(/authorization|token|raw|body/i);
  });

  it("sanitizes rejection diagnostics", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await ingestVerifiedMarketSnapshot({
      instrument: "NIFTY50", price: 1, observedAt: NOW, sourceTimestamp: NOW, providerAlias: "upstox", providerStatus: "FAILED", dataQuality: "INVALID", freshnessMs: 0, persistedAt: NOW, snapshotId: "bad-token-secret",
    }, repo);
    expect(repo.getMarketSnapshotStats().rejectedSnapshotCount).toBe(1);
    expect(repo.getMarketSnapshotStats().lastSnapshotRejectionReason).not.toMatch(/token|secret/i);
  });

  it("is SSR safe", () => {
    expect(typeof window).toBe("undefined");
  });
});

describe("verified market snapshot scheduler integration", () => {
  it("keeps missing snapshots pending", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(decision());
    const result = await runOutcomeScheduler({ repository: repo, evaluatedAt: NOW });
    expect(result.pendingQueue).toBe(1);
    expect(result.items[0]?.status).toBe("SKIPPED_MISSING_SNAPSHOT");
    expect(repo.getOutcome("snapshot-run-1")).toBeNull();
  });

  it("evaluates pending runs from verified repository snapshots", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(decision());
    await repo.recordMarketSnapshot(snapshot());
    const loaded = findSchedulerVerifiedSnapshot(repo, { instrument: "NIFTY50", evaluationTimestamp: NOW });
    expect(loaded?.price).toBe(24080);
    const result = await runOutcomeScheduler({ repository: repo, evaluatedAt: NOW });
    expect(result.evaluatedQueue).toBe(1);
    expect(repo.getOutcome("snapshot-run-1")?.outcomeState).toBe("WIN");
  });

  it("never overwrites an existing outcome", async () => {
    const repo = new InMemoryDecisionHistoryRepository();
    await repo.save(decision());
    await repo.recordMarketSnapshot(snapshot());
    await runOutcomeScheduler({ repository: repo, evaluatedAt: NOW });
    await repo.recordMarketSnapshot(snapshot({ snapshotId: "lower", price: 23000 }));
    const second = await runOutcomeScheduler({ repository: repo, evaluatedAt: NOW });
    expect(second.items[0]?.status).toBe("SKIPPED_ALREADY_EVALUATED");
    expect(repo.getOutcome("snapshot-run-1")?.outcomeState).toBe("WIN");
  });

  it("keeps historical accuracy NO_DATA without evaluated outcomes and replay unchanged", () => {
    expect(selectHistoricalAccuracyFromOutcomes([], { instrument: "NIFTY50", formulaVersion: "decision@1.0.0" }).capability).toBe("NO_DATA");
    expect(replayUnavailableFromDecisionHistory(1).capability).toBe("NO_DATA");
  });
});
