import { describe, expect, it } from "vitest";
import { InMemoryAlertRepository, type AlertRepositoryRecord } from "./repository";

function record(id: string, over: Partial<AlertRepositoryRecord> = {}): AlertRepositoryRecord {
  return {
    id,
    fingerprint: over.fingerprint ?? `fp-${id}`,
    type: over.type ?? "DECISION_CHANGED",
    priority: over.priority ?? "HIGH",
    title: over.title ?? `Alert ${id}`,
    summary: over.summary ?? "Decision changed",
    instrument: over.instrument === undefined ? "NIFTY" : over.instrument,
    tradingDate: over.tradingDate ?? "2026-08-02",
    generatedAt: over.generatedAt ?? `2026-08-02T09:0${id}.000Z`,
    readAt: over.readAt ?? null,
    dismissedAt: over.dismissedAt ?? null,
    rulesVersion: over.rulesVersion ?? "1.0.0",
    sourceModules: over.sourceModules ?? ["DECISION_ENGINE"],
    payload: over.payload ?? null,
  };
}

describe("smart-alerts repository contract", () => {
  it("lists empty and persisted alerts deterministically", () => {
    const repo = new InMemoryAlertRepository();
    expect(repo.listAlerts()).toEqual([]);
    repo.recordAlert(record("2"));
    repo.recordAlert(record("1"));
    expect(repo.listAlerts().map((item) => item.id)).toEqual(["2", "1"]);
  });

  it("marks read, dismisses, and marks all read idempotently", () => {
    const repo = new InMemoryAlertRepository();
    repo.recordAlert(record("1"));
    repo.recordAlert(record("2"));
    expect(repo.markAlertRead("1", "2026-08-02T10:00:00.000Z")).toBe(true);
    expect(repo.getAlert("1")?.readAt).toBe("2026-08-02T10:00:00.000Z");
    expect(repo.dismissAlert("2", "2026-08-02T10:01:00.000Z")).toBe(true);
    expect(repo.getAlert("2")?.dismissedAt).toBe("2026-08-02T10:01:00.000Z");
    expect(repo.markAllRead("2026-08-02T10:02:00.000Z")).toBe(0);
  });

  it("prevents duplicate alert IDs and fingerprints", () => {
    const repo = new InMemoryAlertRepository();
    repo.recordAlert(record("1", { fingerprint: "same", title: "first" }));
    repo.recordAlert(record("1", { fingerprint: "different", title: "conflict" }));
    repo.recordAlert(record("2", { fingerprint: "same", title: "duplicate" }));
    expect(repo.listAlerts()).toHaveLength(1);
    expect(repo.getAlert("1")?.title).toBe("first");
  });

  it("applies filters and nullable search safely", () => {
    const repo = new InMemoryAlertRepository();
    repo.recordAlert(record("1", { instrument: null, title: "Null instrument" }));
    repo.recordAlert(record("2", { type: "DATA_STALE", priority: "LOW", summary: "Stale data" }));
    expect(repo.listAlerts({ search: "null" }).map((item) => item.id)).toEqual(["1"]);
    expect(repo.listAlerts({ type: "DATA_STALE", priority: "LOW" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("preserves bounded retention and immutable readbacks", () => {
    const repo = new InMemoryAlertRepository(2);
    repo.recordAlert(record("1"));
    repo.recordAlert(record("2"));
    repo.recordAlert(record("3"));
    expect(repo.listAlerts().map((item) => item.id)).toEqual(["3", "2"]);
    const item = repo.getAlert("3");
    expect(() => ((item as { title: string }).title = "mutated")).toThrow();
  });
});
