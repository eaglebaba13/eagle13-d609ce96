import { describe, it, expect } from "vitest";
import { computePortfolioSummary, positionPnl } from "./portfolio";
import { computePositionSize, computeRiskReport, computeDecisionOverlay, DEFAULT_LIMITS } from "./risk-engine";
import { addSymbol, createWatchlist, filterWatchlist, removeSymbol, togglePin } from "./watchlist";
import { evaluateAlerts, makeAlert } from "./alerts";
import { allocationToCsv, buildAllocation, buildReport, positionsToCsv, REPORT_SCHEMA_VERSION } from "./reports";
import { demoPortfolio } from "./demo";
import type { Position } from "./types";

const NOW = Date.parse("2026-07-28T10:00:00Z");

describe("portfolio computations", () => {
  it("computes pnl by direction", () => {
    const call: Position = { id: "1", instrument: "X", direction: "CALL", entryPrice: 100, currentPrice: 120, quantity: 10, stopLoss: null, target: null, status: "OPEN", openedAt: "" };
    const put: Position = { ...call, direction: "PUT" };
    expect(positionPnl(call)).toBe(200);
    expect(positionPnl(put)).toBe(-200);
  });
  it("summary reports invested / unrealized / totals", () => {
    const s = computePortfolioSummary(demoPortfolio, NOW);
    expect(s.openPositions).toBe(2);
    expect(s.closedPositions).toBe(1);
    expect(s.investedCapital).toBeGreaterThan(0);
    expect(s.availableCapital).toBeLessThan(s.totalCapital);
    expect(s.dailyPnl).toBe(850);
    expect(s.weeklyPnl).toBe(2650);
  });
});

describe("position sizing", () => {
  it("rejects invalid inputs", () => {
    expect(computePositionSize({ capital: 0, riskPct: 1, entry: 100, stopLoss: 90 }).valid).toBe(false);
    expect(computePositionSize({ capital: 1000, riskPct: 0, entry: 100, stopLoss: 90 }).valid).toBe(false);
    expect(computePositionSize({ capital: 1000, riskPct: 1, entry: 100, stopLoss: 100 }).valid).toBe(false);
  });
  it("rounds down to lots and computes max loss", () => {
    const r = computePositionSize({ capital: 100_000, riskPct: 1, entry: 100, stopLoss: 99, lotSize: 10 });
    expect(r.valid).toBe(true);
    expect(r.recommendedQuantity).toBe(1000);
    expect(r.maxLoss).toBe(1000);
  });
});

describe("risk engine", () => {
  it("reports risk levels and identifies breaches", () => {
    const r = computeRiskReport(demoPortfolio, DEFAULT_LIMITS, NOW);
    expect(r.perPosition.length).toBe(2);
    expect(r.exposurePct).toBeGreaterThan(0);
    expect(["LOW","MEDIUM","HIGH","CRITICAL"]).toContain(r.level);
  });
  it("flags decision overlay when portfolio risk exceeds cap", () => {
    const o = computeDecisionOverlay({
      action: "BUY_CALL", entry: 100, stopLoss: 90, capital: 100_000, riskPct: 5, currentRiskPct: 5,
    });
    expect(o.warnings.length).toBeGreaterThan(0);
    expect(o.riskLevel).toBe("CRITICAL");
  });
});

describe("watchlist", () => {
  it("adds, dedupes, pins, removes and filters", () => {
    let w = createWatchlist("wl", "Test");
    w = addSymbol(w, "nifty");
    w = addSymbol(w, "NIFTY");
    w = addSymbol(w, "TCS");
    expect(w.items.length).toBe(2);
    w = togglePin(w, "TCS");
    const filtered = filterWatchlist(w, "tc");
    expect(filtered[0].symbol).toBe("TCS");
    w = removeSymbol(w, "NIFTY");
    expect(w.items.map((i) => i.symbol)).toEqual(["TCS"]);
  });
});

describe("alerts", () => {
  it("triggers on AI decision change and PCR threshold", () => {
    const alerts = [
      makeAlert("a1", "AI_DECISION_CHANGED", { message: "AI change" }),
      makeAlert("a2", "PCR_THRESHOLD", { threshold: 1.2, direction: "ABOVE", message: "pcr" }),
    ];
    const { next, triggered } = evaluateAlerts(alerts, {
      previousAiDecisionAction: "WAIT",
      aiDecisionAction: "BUY_CALL",
      pcr: 1.3,
    });
    expect(triggered.length).toBe(2);
    expect(next.every((a) => !a.active)).toBe(true);
  });
});

describe("reports & exports", () => {
  it("builds allocation and full report", () => {
    const alloc = buildAllocation(demoPortfolio);
    expect(alloc.length).toBe(2);
    const total = alloc.reduce((s, r) => s + r.pct, 0);
    expect(Math.round(total)).toBe(100);
    const report = buildReport(demoPortfolio, undefined, NOW);
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(report.performance.wins + report.performance.losses).toBeGreaterThanOrEqual(1);
  });
  it("csv escapes and includes header", () => {
    const csv = positionsToCsv(demoPortfolio);
    expect(csv.split("\n")[0]).toContain("instrument");
    expect(csv.split("\n").length).toBe(demoPortfolio.positions.length + 1);
    const ac = allocationToCsv(buildAllocation(demoPortfolio));
    expect(ac.startsWith("instrument,exposure,pct")).toBe(true);
  });
});