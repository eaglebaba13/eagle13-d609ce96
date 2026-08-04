import { describe, expect, it, vi } from "vitest";
import { persistCompletedDecision } from "./persistence.functions";
import { createDecisionRunId } from "./run-id";
import { deserializeDecisionRecord, serializeDecisionRecord } from "./serializer";
import type { DecisionPersistenceRepository, DecisionPersistedRecord } from "./types";

class TestRepository implements DecisionPersistenceRepository {
  public items: DecisionPersistedRecord[] = [];

  async save(record: DecisionPersistedRecord): Promise<void> {
    this.items.push(record);
  }
}

describe("decision history persistence", () => {
  it("persists a normalized immutable record", async () => {
    const repo = new TestRepository();
    const input = {
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 22340,
      decision: "BUY_CE",
      confidence: 83.4,
      risk: { level: "MEDIUM", reasons: ["volatility"] },
      signals: [{ key: "astro", present: true, bias: "BULL", score: 0.4 }],
      capabilities: { options: { capability: "SUPPORTED" } },
      summary: { action: "BUY_CE", confidence: 83.4 },
      formulaVersions: { astro: "v1", decision: "v2" },
      providerLabels: { options: "live-upstox" },
    };

    const result = await persistCompletedDecision(input, repo);

    expect(result.ok).toBe(true);
    expect(result.runId).toBe(createDecisionRunId({ timestamp: input.timestamp, instrument: input.instrument, decision: input.decision, confidence: input.confidence }));
    expect(repo.items).toHaveLength(1);
    expect(repo.items[0]).toMatchObject({
      instrument: "NIFTY",
      decision: "BUY_CE",
      confidence: 83.4,
      risk: { level: "MEDIUM", reasons: ["volatility"] },
      formulaVersions: { astro: "v1", decision: "v2" },
      providerLabels: { options: "live-upstox" },
    });
    expect(repo.items[0]).not.toHaveProperty("authorization");
  });

  it("serializes and deserializes without losing core fields", () => {
    const record: DecisionPersistedRecord = {
      runId: "decision-NIFTY-20260730-001",
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 22340,
      decision: "WAIT",
      confidence: 21.2,
      risk: { level: "LOW", reasons: ["insufficient"] },
      signals: [{ key: "replay", present: false, bias: "NEUTRAL", score: 0 }],
      capabilities: { historical: { capability: "NO_DATA" } },
      summary: { action: "WAIT", confidence: 21.2 },
      formulaVersions: { astro: "v1" },
      providerLabels: { options: "live" },
    };

    const serialized = serializeDecisionRecord(record);
    const restored = deserializeDecisionRecord(serialized);
    expect(restored).toEqual(record);
  });

  it("generates a deterministic run id", () => {
    const a = createDecisionRunId({ timestamp: "2026-07-30T10:00:00.000Z", instrument: "NIFTY", decision: "BUY_CE", confidence: 83.4 });
    const b = createDecisionRunId({ timestamp: "2026-07-30T10:00:00.000Z", instrument: "NIFTY", decision: "BUY_CE", confidence: 83.4 });
    expect(a).toBe(b);
    expect(a).toContain("decision-");
  });

  it("falls back gracefully when persistence throws", async () => {
    const repo: DecisionPersistenceRepository = {
      save: async () => {
        throw new Error("boom");
      },
    };

    const result = await persistCompletedDecision({
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "BANKNIFTY",
      spot: 48000,
      decision: "BUY_PE",
      confidence: 74,
      risk: { level: "MEDIUM", reasons: [] },
      signals: [],
      capabilities: {},
      summary: { action: "BUY_PE", confidence: 74 },
      formulaVersions: { astro: "v1" },
      providerLabels: {},
    }, repo);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("boom");
  });

  it("redacts secrets during serialization", () => {
    const record: DecisionPersistedRecord = {
      runId: "decision-test",
      timestamp: "2026-07-30T10:00:00.000Z",
      instrument: "NIFTY",
      spot: 22340,
      decision: "WAIT",
      confidence: 10,
      risk: { level: "LOW", reasons: [] },
      signals: [],
      capabilities: {
        options: {
          authorization: "Bearer secret",
          apiKey: "abc123",
        },
      },
      summary: { action: "WAIT", confidence: 10 },
      formulaVersions: { astro: "v1" },
      providerLabels: {},
    };

    const serialized = serializeDecisionRecord(record);
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("abc123");
    expect(serialized).toContain("[REDACTED]");
  });
});
