import { describe, it, expect } from "vitest";
import { evaluateCondition, evaluateGroup } from "./evaluator";
import { runBacktest } from "./backtest";
import { generateSyntheticBars } from "./synthetic-bars";
import { BUILTIN_STRATEGIES } from "./templates";
import { generateReport } from "./report";
import { tradesToCsv, backtestToJson, reportToPrintable } from "./exports";
import type { Strategy } from "./types";

describe("Phase 51 · evaluator", () => {
  it("returns null when indicator is missing", () => {
    expect(evaluateCondition({ id: "c", indicator: "GTI", op: ">", value: 50 }, {})).toBeNull();
  });
  it("evaluates comparators", () => {
    const snap = { GTI: 60, VIX: 12 };
    expect(evaluateCondition({ id: "c", indicator: "GTI", op: ">", value: 55 }, snap)).toBe(true);
    expect(evaluateCondition({ id: "c", indicator: "VIX", op: "<=", value: 15 }, snap)).toBe(true);
  });
  it("AND / OR / NOT combinators", () => {
    const snap = { GTI: 60, VIX: 20 };
    expect(evaluateGroup({ id: "g", combinator: "AND", conditions: [
      { id: "a", indicator: "GTI", op: ">", value: 50 },
      { id: "b", indicator: "VIX", op: "<", value: 18 },
    ] }, snap)).toBe(false);
    expect(evaluateGroup({ id: "g", combinator: "OR", conditions: [
      { id: "a", indicator: "GTI", op: ">", value: 50 },
      { id: "b", indicator: "VIX", op: "<", value: 18 },
    ] }, snap)).toBe(true);
    expect(evaluateGroup({ id: "g", combinator: "OR", negate: true, conditions: [
      { id: "a", indicator: "GTI", op: ">", value: 50 },
    ] }, snap)).toBe(false);
  });
});

describe("Phase 51 · backtest engine", () => {
  const bars = generateSyntheticBars({ seed: 3, bars: 200 });
  it("is deterministic for the same inputs", () => {
    const s = BUILTIN_STRATEGIES[0];
    const a = runBacktest(s, bars);
    const b = runBacktest(s, bars);
    expect(a.totalTrades).toBe(b.totalTrades);
    expect(a.totalPnl).toBe(b.totalPnl);
  });
  it("produces valid metrics envelope", () => {
    const r = runBacktest(BUILTIN_STRATEGIES[0], bars);
    expect(r.equityCurve.length).toBe(bars.length);
    expect(r.drawdownCurve.length).toBe(bars.length);
    expect(r.winRate + r.lossRate).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.maxDrawdown).toBeGreaterThanOrEqual(0);
  });
  it("respects maxTrades cap", () => {
    const capped: Strategy = { ...BUILTIN_STRATEGIES[0], risk: { maxTrades: 2 } };
    const r = runBacktest(capped, bars);
    expect(r.totalTrades).toBeLessThanOrEqual(2);
  });
  it("skips conditions with missing indicators without fabricating", () => {
    const s: Strategy = {
      id: "x", name: "x",
      entry: { id: "g", combinator: "AND", conditions: [{ id: "c", indicator: "GTI", op: ">", value: 50 }] },
      action: { kind: "BUY_CALL" },
    };
    const barsNoInd = bars.map((b) => ({ ...b, indicators: {} }));
    const r = runBacktest(s, barsNoInd);
    expect(r.totalTrades).toBe(0);
  });
});

describe("Phase 51 · report & exports", () => {
  const bars = generateSyntheticBars({ seed: 5, bars: 150 });
  const r = runBacktest(BUILTIN_STRATEGIES[1], bars);
  it("generates a report with all sections", () => {
    const rep = generateReport(r);
    expect(rep.summary).toContain(BUILTIN_STRATEGIES[1].name);
    expect(Array.isArray(rep.strengths)).toBe(true);
  });
  it("emits CSV, JSON, and printable text", () => {
    const rep = generateReport(r);
    expect(tradesToCsv(r).split("\n")[0]).toContain("entryTime");
    const json = JSON.parse(backtestToJson(BUILTIN_STRATEGIES[1], r, rep));
    expect(json.strategy.name).toBe(BUILTIN_STRATEGIES[1].name);
    expect(reportToPrintable(BUILTIN_STRATEGIES[1], r, rep)).toContain("STRATEGY REPORT");
  });
});

describe("Phase 51 · templates", () => {
  it("has 7 built-in strategies", () => {
    expect(BUILTIN_STRATEGIES.length).toBe(7);
    expect(BUILTIN_STRATEGIES.every((s) => s.builtin)).toBe(true);
  });
});