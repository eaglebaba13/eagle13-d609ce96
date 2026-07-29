import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ProvenanceChip } from "./ProvenanceChip";
import type { ProviderProvenance } from "@/lib/provider-health-registry";

const sample: ProviderProvenance = {
  providerId: "yahoo",
  label: "YAHOO",
  status: "HEALTHY",
  fetchedAt: "2026-07-29T09:00:00Z",
  sourceTimestamp: null,
  ageSeconds: 12,
  freshness: "FRESH",
  latencyMs: 180,
  qualityScore: 95,
  qualityCodes: [],
  failoverState: "PRIMARY",
  cached: false,
  lastSuccessAt: "2026-07-29T09:00:00Z",
};

describe("ProvenanceChip", () => {
  it("returns null when provenance is missing", () => {
    const html = renderToStaticMarkup(createElement(ProvenanceChip, { provenance: null }));
    expect(html).toBe("");
  });

  it("renders provider label, freshness and quality for a healthy source", () => {
    const html = renderToStaticMarkup(createElement(ProvenanceChip, { provenance: sample }));
    expect(html).toContain("YAHOO");
    expect(html).toContain("FRESH");
    expect(html).toContain("Q95");
    expect(html).not.toContain("MOCK");
  });

  it("tags mock sources so the UI never presents them as live", () => {
    const html = renderToStaticMarkup(
      createElement(ProvenanceChip, { provenance: { ...sample, mock: true, status: "DEGRADED" } }),
    );
    expect(html).toContain("MOCK");
  });
});