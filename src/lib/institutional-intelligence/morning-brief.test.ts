import { describe, expect, it } from "vitest";
import { renderInstitutionalIntelligenceBlock } from "./morning-brief";
import { RESEARCH_FLOW, RESEARCH_NEWS } from "./index";
import { computeIntelligenceScore } from "./score";
import type { InstitutionalIntelligenceSnapshot } from "./types";

describe("Phase 49 — renderInstitutionalIntelligenceBlock", () => {
  it("renders honest UNAVAILABLE explanations without fabrication", () => {
    const snap: InstitutionalIntelligenceSnapshot = {
      generatedAt: "2026-07-29T02:45:00.000Z",
      weightedBreadth: {
        rows: [], positiveWeightPct: 0, negativeWeightPct: 0,
        weightedBreadthScore: 0, coverage: 0,
        status: "PROVIDER_PENDING", reason: "No quotes returned by Yahoo Finance",
      },
      nifty50Breadth: {
        advancing: 0, declining: 0, unchanged: 0, total: 0,
        breadthPct: 0, advanceDeclineRatio: null,
        status: "PROVIDER_PENDING", reason: null,
      },
      sectors: {
        rows: [], leaders: [], laggards: [],
        bullishCount: 0, neutralCount: 0, bearishCount: 0,
        rotationBias: 0, coverage: 0,
        status: "PROVIDER_PENDING", reason: null,
      },
      flow: RESEARCH_FLOW,
      news: RESEARCH_NEWS,
      score: computeIntelligenceScore({}),
      overallStatus: "PROVIDER_PENDING",
    };
    const text = renderInstitutionalIntelligenceBlock(snap);
    expect(text).toContain("Institutional Score:");
    expect(text).toContain("OFFICIAL_SOURCE_REQUIRED");
    expect(text).toContain("PROVIDER_PENDING");
    expect(text).not.toContain("undefined");
  });
});