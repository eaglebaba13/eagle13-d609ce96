import { describe, it, expect } from "vitest";
import { makeStrike, type OptionChainSnapshot } from "@/lib/option-chain/types";
import {
  computeMaxPain,
  computeGammaExposure,
  computeGammaWalls,
  computeDealerPositioning,
  computeOiBuildup,
  classifyLeg,
  computeIvRank,
  computeIvPercentile,
  classifyIvRegime,
  computeExpectedMove,
  computeSupportResistance,
  computeMarketStructure,
  computeConfidence,
  buildOptionsAnalyticsReport,
  toJson,
  toCsv,
  toPrintable,
} from "./index";

function snap(overrides: Partial<OptionChainSnapshot> = {}): OptionChainSnapshot {
  const strikes = [
    makeStrike(24000, { oi: 100, changeOi: 50, iv: 0.15, greeks: { delta: 0.6, gamma: 0.001, theta: null, vega: null, rho: null } },
                       { oi: 200, changeOi: -20, iv: 0.14, greeks: { delta: -0.4, gamma: 0.0009, theta: null, vega: null, rho: null } }),
    makeStrike(24100, { oi: 300, changeOi: 100, iv: 0.14, greeks: { delta: 0.5, gamma: 0.0012, theta: null, vega: null, rho: null } },
                       { oi: 400, changeOi: 30, iv: 0.14, greeks: { delta: -0.5, gamma: 0.0012, theta: null, vega: null, rho: null } }),
    makeStrike(24200, { oi: 500, changeOi: 200, iv: 0.13, greeks: { delta: 0.4, gamma: 0.001, theta: null, vega: null, rho: null } },
                       { oi: 100, changeOi: -50, iv: 0.13, greeks: { delta: -0.6, gamma: 0.0008, theta: null, vega: null, rho: null } }),
  ];
  return {
    instrument: "NIFTY",
    spotPrice: 24100,
    timestamp: "2026-07-29T05:00:00.000Z",
    provider: "MOCK",
    expiry: "2026-08-07",
    availableExpiries: ["2026-08-07"],
    marketSession: "OPEN",
    dataQuality: "OK",
    strikes,
    ...overrides,
  };
}

describe("max pain", () => {
  it("returns a strike from the chain", () => {
    const r = computeMaxPain(snap());
    expect(r.availability).toBe("OK");
    expect([24000, 24100, 24200]).toContain(r.strike);
    expect(r.confidence).toBe(100);
  });
  it("handles empty chain", () => {
    const r = computeMaxPain(snap({ strikes: [] }));
    expect(r.availability).toBe("UNAVAILABLE");
    expect(r.strike).toBe(null);
  });
  it("reports dailyChange when prior provided", () => {
    const r = computeMaxPain(snap(), 24000);
    expect(r.dailyChange).not.toBe(null);
  });
});

describe("gamma exposure", () => {
  it("computes when greeks present", () => {
    const r = computeGammaExposure(snap());
    expect(r.availability).toBe("OK");
    expect(r.totalGamma).not.toBe(null);
    expect(r.cumulativeGamma.length).toBe(3);
  });
  it("UNAVAILABLE when greeks absent", () => {
    const s = snap();
    const stripped: OptionChainSnapshot = {
      ...s,
      strikes: s.strikes.map((x) => makeStrike(x.strike, { ...x.call, greeks: null }, { ...x.put, greeks: null })),
    };
    const r = computeGammaExposure(stripped);
    expect(r.availability).toBe("UNAVAILABLE");
  });
  it("detects gamma flip when signs cross", () => {
    const s = snap();
    // Force a negative-then-positive per-strike pattern via oi asymmetry.
    const strikes = [
      makeStrike(24000, { oi: 10, greeks: { delta: 0, gamma: 0.001, theta: null, vega: null, rho: null } }, { oi: 1000, greeks: { delta: 0, gamma: 0.001, theta: null, vega: null, rho: null } }),
      makeStrike(24100, { oi: 1000, greeks: { delta: 0, gamma: 0.001, theta: null, vega: null, rho: null } }, { oi: 10, greeks: { delta: 0, gamma: 0.001, theta: null, vega: null, rho: null } }),
    ];
    const r = computeGammaExposure({ ...s, strikes });
    expect(r.gammaFlipStrike).not.toBe(null);
  });
});

describe("gamma walls", () => {
  it("returns walls when gamma OK", () => {
    const gex = computeGammaExposure(snap());
    const w = computeGammaWalls(gex, 24100);
    expect(w.availability).toBe("OK");
    expect(w.strongestWall).not.toBe(null);
  });
  it("UNAVAILABLE when gex unavailable", () => {
    const w = computeGammaWalls({ availability: "UNAVAILABLE", cumulativeGamma: [], totalGamma: null, callGamma: null, putGamma: null, netGamma: null, positiveGammaStrikes: [], negativeGammaStrikes: [], gammaFlipStrike: null, reason: "" }, 24100);
    expect(w.availability).toBe("UNAVAILABLE");
  });
});

describe("dealer positioning", () => {
  it("classifies posture from netGamma", () => {
    const gex = computeGammaExposure(snap());
    const d = computeDealerPositioning(gex, 24100);
    expect(["LONG_GAMMA", "SHORT_GAMMA", "NEUTRAL"]).toContain(d.posture);
    expect(d.availability).not.toBe("UNAVAILABLE");
  });
});

describe("OI build-up", () => {
  it("classifies each leg", () => {
    const r = computeOiBuildup(snap());
    expect(r.rows.length).toBe(6);
    expect(r.availability).toBe("OK");
  });
  it("classifyLeg direction rules", () => {
    expect(classifyLeg(10, 1)).toBe("LONG_BUILDUP");
    expect(classifyLeg(10, -1)).toBe("SHORT_BUILDUP");
    expect(classifyLeg(-10, 1)).toBe("SHORT_COVERING");
    expect(classifyLeg(-10, -1)).toBe("LONG_UNWINDING");
    expect(classifyLeg(null, 1)).toBe("UNAVAILABLE");
  });
});

describe("IV rank/percentile/regime", () => {
  it("IV rank basic", () => {
    const r = computeIvRank(0.2, [0.1, 0.15, 0.3]);
    expect(r.availability).toBe("OK");
    expect(r.rank).toBeCloseTo(50);
  });
  it("IV percentile basic", () => {
    const r = computeIvPercentile(0.2, [0.1, 0.15, 0.25, 0.3]);
    expect(r.pct).toBeCloseTo(50);
  });
  it("regime classification", () => {
    expect(classifyIvRegime(10).regime).toBe("LOW");
    expect(classifyIvRegime(40).regime).toBe("NORMAL");
    expect(classifyIvRegime(70).regime).toBe("HIGH");
    expect(classifyIvRegime(95).regime).toBe("EXTREME");
    expect(classifyIvRegime(null).regime).toBe("UNAVAILABLE");
  });
  it("iv-rank unavailable when history too small", () => {
    expect(computeIvRank(0.2, []).availability).toBe("UNAVAILABLE");
  });
});

describe("expected move", () => {
  it("computes bands when spot/iv/expiry valid", () => {
    const r = computeExpectedMove(snap(), new Date("2026-07-29T05:00:00.000Z"));
    expect(r.availability).toBe("OK");
    expect(r.upperBand).toBeGreaterThan(r.lowerBand!);
  });
  it("UNAVAILABLE without spot", () => {
    const r = computeExpectedMove(snap({ spotPrice: null }));
    expect(r.availability).toBe("UNAVAILABLE");
  });
});

describe("support / resistance", () => {
  it("merges levels", () => {
    const s = snap();
    const gex = computeGammaExposure(s);
    const walls = computeGammaWalls(gex, s.spotPrice);
    const mp = computeMaxPain(s);
    const d = computeDealerPositioning(gex, s.spotPrice);
    const sr = computeSupportResistance(s, walls, mp, d);
    expect(sr.availability).toBe("OK");
    expect(sr.levels.length).toBeGreaterThan(0);
  });
});

describe("market structure", () => {
  it("returns UNAVAILABLE when all inputs missing", () => {
    const r = computeMarketStructure(
      { atmIv: null, daysToExpiry: null, upperBand: null, lowerBand: null, expectedRange: null, availability: "UNAVAILABLE" },
      { posture: "UNAVAILABLE", hedgingPressure: "UNAVAILABLE", directionalBias: "UNAVAILABLE", volatilityExpectation: "UNAVAILABLE", netGamma: null, availability: "UNAVAILABLE" },
      { atmIv: null, ivRank: null, ivPercentile: null, regime: "UNAVAILABLE", sampleSize: 0, availability: "UNAVAILABLE" },
    );
    expect(r.availability).toBe("UNAVAILABLE");
  });
});

describe("confidence engine", () => {
  it("scores between 0 and 100", () => {
    const s = snap();
    const gex = computeGammaExposure(s);
    const c = computeConfidence(s, gex, { atmIv: null, ivRank: null, ivPercentile: null, regime: "UNAVAILABLE", sampleSize: 0, availability: "UNAVAILABLE" });
    expect(c.score).toBeGreaterThan(0);
    expect(c.score).toBeLessThanOrEqual(100);
    expect(c.missing).toContain("iv-history");
  });
  it("empty chain yields low score", () => {
    const s = snap({ strikes: [], dataQuality: "FAILED", expiry: "" });
    const gex = computeGammaExposure(s);
    const c = computeConfidence(s, gex, { atmIv: null, ivRank: null, ivPercentile: null, regime: "UNAVAILABLE", sampleSize: 0, availability: "UNAVAILABLE" });
    expect(c.score).toBeLessThan(30);
  });
});

describe("report export", () => {
  it("builds a deterministic report and exports JSON/CSV/printable", () => {
    const r = buildOptionsAnalyticsReport({ snapshot: snap(), ivHistory: [0.1, 0.15, 0.2], now: new Date("2026-07-29T05:00:00.000Z") });
    expect(r.instrument).toBe("NIFTY");
    const j = toJson(r);
    expect(j).toContain("maxPain");
    const c = toCsv(r);
    expect(c.split("\n")[0]).toBe("section,key,value");
    const p = toPrintable(r);
    expect(p).toContain("Options Analytics Report");
  });
  it("survives corrupted/empty inputs without throwing", () => {
    const bad = snap({ strikes: [], spotPrice: null, expiry: "" });
    const r = buildOptionsAnalyticsReport({ snapshot: bad });
    expect(r.confidence.score).toBeGreaterThanOrEqual(0);
    expect(r.maxPain.availability).toBe("UNAVAILABLE");
  });
});

describe("SSR safety", () => {
  it("module has no top-level browser globals", async () => {
    // Import in a stripped environment; should not touch window/document.
    const mod = await import("./index");
    expect(typeof mod.buildOptionsAnalyticsReport).toBe("function");
  });
});