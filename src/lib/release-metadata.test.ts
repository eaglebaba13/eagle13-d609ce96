import { describe, it, expect } from "vitest";
import { getReleaseMetadata, NOT_INJECTED, RELEASE_VERDICT } from "./release-metadata";

describe("release-metadata", () => {
  it("returns a metadata object with all canonical fields", () => {
    const m = getReleaseMetadata();
    expect(m).toHaveProperty("version");
    expect(m).toHaveProperty("buildId");
    expect(m).toHaveProperty("commitSha");
    expect(m).toHaveProperty("deployedAt");
    expect(m).toHaveProperty("channel");
    expect(m).toHaveProperty("environment");
  });

  it("uses NOT INJECTED sentinel for missing env vars (never fabricates)", () => {
    const m = getReleaseMetadata();
    for (const v of Object.values(m)) {
      expect(typeof v).toBe("string");
      if (v === NOT_INJECTED) expect(v).toBe("NOT INJECTED");
    }
  });

  it("exports the closed-beta verdict", () => {
    expect(RELEASE_VERDICT).toBe("READY FOR CLOSED BETA");
  });
});