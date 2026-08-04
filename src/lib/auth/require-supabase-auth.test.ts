import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isServerLocalBypassEnabled } from "@/lib/local-dev-auth";

const source = readFileSync("src/lib/auth/require-supabase-auth.ts", "utf8");
const guard = readFileSync("src/routes/_authenticated/route.tsx", "utf8");

describe("Phase 52D — requireSupabaseAuth wiring", () => {
  it("keeps the production bearer-token checks intact", () => {
    expect(source).toContain("Unauthorized: No authorization header provided");
    expect(source).toContain("Unauthorized: Only Bearer tokens are supported");
    expect(source).toContain("Unauthorized: Invalid token");
    expect(source).toContain("supabase.auth.getClaims(token)");
  });

  it("gates the bypass on NODE_ENV, host and the explicit flag", () => {
    expect(source).toContain("isServerLocalBypassEnabled");
    expect(source).toContain("process.env.NODE_ENV");
    expect(source).toContain("process.env.LOCAL_DEV_AUTH_BYPASS");
  });

  it("never ships service-role or Upstox secrets to the client context", () => {
    expect(source).not.toContain("SERVICE_ROLE");
    expect(source).not.toContain("UPSTOX_");
  });

  it("allows protected server functions locally and rejects them in production", () => {
    const local = { nodeEnv: "development", host: "localhost:8080", flag: "true" };
    const prod = { nodeEnv: "production", host: "eagle13.lovable.app", flag: "true" };
    expect(isServerLocalBypassEnabled(local)).toBe(true);
    expect(isServerLocalBypassEnabled(prod)).toBe(false);
  });

  it("route guard skips the /auth redirect locally but keeps it otherwise", () => {
    expect(guard).toContain("clientLocalBypassActive()");
    expect(guard).toContain('redirect({ to: "/auth" })');
  });
});
