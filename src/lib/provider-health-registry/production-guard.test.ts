import { describe, it, expect, beforeEach } from "vitest";
import { assertProductionProvider, MOCK_BLOCKED_CODE } from "./production-guard";
import { _resetProviderHealthRegistry, getProviderHealth } from "./registry";

describe("assertProductionProvider", () => {
  beforeEach(() => _resetProviderHealthRegistry());

  it("allows live providers unconditionally", () => {
    const r = assertProductionProvider({ providerId: "yahoo", isMock: false, isProduction: true });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("ALLOWED_LIVE");
  });

  it("allows mock providers in non-production", () => {
    const r = assertProductionProvider({ providerId: "mock", isMock: true, isProduction: false });
    expect(r.allowed).toBe(true);
    expect(r.mock).toBe(true);
  });

  it("blocks mock providers in production and records a diagnostic", () => {
    const r = assertProductionProvider({ providerId: "mock", isMock: true, isProduction: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe(MOCK_BLOCKED_CODE);
    expect(getProviderHealth("mock")!.code).toBe("UNAVAILABLE");
  });

  it("respects the explicit dev override in production", () => {
    const r = assertProductionProvider({
      providerId: "mock",
      isMock: true,
      isProduction: true,
      allowMockOverride: true,
    });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe("ALLOWED_MOCK_OVERRIDE");
  });
});