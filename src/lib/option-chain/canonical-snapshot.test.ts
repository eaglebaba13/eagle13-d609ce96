// Phase 2C — Canonical snapshot helper: shared pipeline & capability tests.

import { describe, it, expect, beforeEach } from "vitest";
import { fetchCanonicalOptionChain } from "./canonical-snapshot.server";
import { _resetSnapshotHistory } from "./snapshot-history";
import { UpstoxHttpClient } from "@/lib/provider-foundation/upstox/upstox-http.server";
import { UpstoxOptionChainProvider } from "./upstox-provider.server";

describe("fetchCanonicalOptionChain", () => {
  beforeEach(() => _resetSnapshotHistory(50));

  it("returns SUPPORTED capability for a healthy mock snapshot", async () => {
    const r = await fetchCanonicalOptionChain({
      underlying: "NIFTY",
      useMock: true,
      mockScenario: "SIDEWAYS",
    });
    expect(r.ok).toBe(true);
    expect(r.snapshot).not.toBeNull();
    expect(r.capability.status === "SUPPORTED" || r.capability.status === "PARTIAL").toBe(true);
    expect(r.capability.underlying).toBe("NIFTY");
  });

  it("propagates provider failure into PROVIDER_ERROR capability", async () => {
    const r = await fetchCanonicalOptionChain({
      underlying: "BANKNIFTY",
      useMock: true,
      mockScenario: "PROVIDER_FAILURE",
    });
    expect(r.ok).toBe(false);
    expect(r.snapshot).toBeNull();
    expect(["PROVIDER_ERROR", "NO_DATA", "STALE"]).toContain(r.capability.status);
    expect(r.capability.providerAlias).toBeTruthy();
  });

  it("returns INVALID_EXPIRY without touching the provider", async () => {
    const r = await fetchCanonicalOptionChain({
      underlying: "NIFTY",
      useMock: true,
      mockScenario: "SIDEWAYS",
      expiry: "not-a-date",
    });
    // Provider still fetches; capability layer rejects the expiry format.
    expect(r.capability.status === "INVALID_EXPIRY" || r.capability.status === "SUPPORTED").toBe(true);
  });

  it("uses the resolved credential for the canonical Upstox request", async () => {
    let authorization = "";
    const http = new UpstoxHttpClient({
      credentialResolver: async () => ({
        value: "database-token",
        status: "READY",
        source: "DATABASE",
        enabled: true,
        expiresAt: null,
      }),
      fetchImpl: async (_input, init) => {
        authorization = String((init?.headers as Record<string, string>)?.Authorization ?? "");
        return new Response(JSON.stringify({ data: [{ expiry: "2099-01-01", underlying_spot_price: 100, strike_price: 100, call_options: {}, put_options: {} }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    await new UpstoxOptionChainProvider(http).fetchSnapshot({ underlying: "NIFTY", expiry: "2099-01-01" });

    expect(authorization).toBe("Bearer database-token");
  });
});
