import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/ProfileMenu.tsx", "utf8");
const ctx = readFileSync("src/lib/auth-context.tsx", "utf8");

describe("Phase 52D — ProfileMenu local dev behaviour", () => {
  it("renders a LOCAL DEV badge when the bypass is active", () => {
    expect(source).toContain("localDevBypass");
    expect(source).toContain("LOCAL DEV");
  });

  it("hides Sign in because the context reports authenticated locally", () => {
    expect(ctx).toContain("isAuthenticated: localDevBypass ? true");
    expect(source).toContain("if (!isAuthenticated)");
  });

  it("disables Sign out under the local bypass", () => {
    expect(source).toContain("Sign out disabled (local dev)");
  });

  it("reports Local Admin identity locally", () => {
    expect(ctx).toContain("LOCAL_DEV_PROFILE");
    expect(ctx).toContain('displayName: LOCAL_DEV_DISPLAY_NAME');
    expect(ctx).toContain("loading: localDevBypass ? false : loading");
  });
});
