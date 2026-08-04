import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => {
  const createServerFn = () => {
    const definition = {
      inputValidator: () => definition,
      middleware: () => definition,
      handler: (handler: unknown) => handler,
    };
    return definition;
  };

  const createMiddleware = () => ({
    server: (handler: unknown) => handler,
  });

  return { createServerFn, createMiddleware };
});

vi.mock("@/lib/auth/require-supabase-auth", () => ({
  requireSupabaseAuth: {},
}));

import {
  clearProviderCredentialCache,
  decryptProviderCredential,
  encryptProviderCredential,
  loadProviderCredentialSetting,
  resolveProviderCredential,
  saveProviderCredentialSetting,
  sanitizeProviderCredentialSettingForClient,
  testProviderCredential,
  type ProviderCredentialStatus,
} from "./provider-credentials.server";

const mockSupabase = {
  from: vi.fn((_table: string) => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) })),
    upsert: vi.fn(async () => ({ error: null })),
    insert: vi.fn(async () => ({ error: null })),
  })),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

describe("provider credential management", () => {
  beforeEach(() => {
    clearProviderCredentialCache();
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts credentials without exposing plaintext", () => {
    const cipher = encryptProviderCredential("super-secret-token");
    expect(cipher).not.toContain("super-secret-token");
    expect(decryptProviderCredential(cipher)).toBe("super-secret-token");
  });

  it("falls back to environment values and reports ENV source", async () => {
    vi.stubEnv("UPSTOX_ACCESS_TOKEN", "env-token");
    const result = await loadProviderCredentialSetting({ provider: "upstox", credentialType: "access_token" });
    expect(result.source).toBe("ENV");
    expect(result.status).toBe("READY");
    expect(result.maskedValue).toBe("••••••");
  });

  it("reports missing credentials when no database or env values exist", async () => {
    const result = await loadProviderCredentialSetting({ provider: "coindcx", credentialType: "api_secret" });
    expect(result.status).toBe<ProviderCredentialStatus>("MISSING");
    expect(result.source).toBe("ENV");
    expect(result.maskedValue).toBe("••••••");
  });

  it("invalidates runtime cache after a save and reloads updated values", async () => {
    vi.stubEnv("UPSTOX_API_KEY", "env-key");
    const first = await loadProviderCredentialSetting({ provider: "upstox", credentialType: "api_key" });
    expect(first.value).toBe("env-key");

    const persisted = await saveProviderCredentialSetting({
      provider: "upstox",
      credentialType: "api_key",
      value: "db-key",
      updatedBy: "admin-user",
      enabled: true,
      storage: "DATABASE",
    });

    expect(persisted.status).toBe("READY");
    const reloaded = await loadProviderCredentialSetting({ provider: "upstox", credentialType: "api_key" });
    expect(reloaded.value).toBe("db-key");
    expect(reloaded.source).toBe("DATABASE");
  });

  it("resolves credentials through the canonical resolver and keeps public output masked", async () => {
    vi.stubEnv("UPSTOX_ACCESS_TOKEN", "env-token");
    const resolved = await resolveProviderCredential({ provider: "upstox", credentialType: "access_token", capability: "upstox-http" });
    expect(resolved.value).toBe("env-token");
    const publicSafe = sanitizeProviderCredentialSettingForClient(resolved);
    expect(publicSafe.value).toBeNull();
    expect(publicSafe.maskedValue).toBe("••••••");
    expect(publicSafe.source).toBe("ENV");
  });

  it("prefers a database credential over the environment fallback", async () => {
    vi.stubEnv("UPSTOX_ACCESS_TOKEN", "env-token");
    const encrypted = encryptProviderCredential("database-token");
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                encrypted_value: encrypted,
                enabled: true,
                updated_at: null,
                updated_by: "admin",
                expires_at: null,
              },
              error: null,
            })),
          })),
        })),
      })),
    }));

    const result = await resolveProviderCredential({
      provider: "upstox",
      credentialType: "access_token",
      capability: "upstox-http",
    });

    expect(result.value).toBe("database-token");
    expect(result.source).toBe("DATABASE");
    expect(result.value).not.toBe("env-token");
  });

  it("does not fall back to environment when a database credential cannot decrypt", async () => {
    clearProviderCredentialCache();
    vi.stubEnv("UPSTOX_ACCESS_TOKEN", "env-token");
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { encrypted_value: "invalid", enabled: true, updated_at: null, updated_by: null, expires_at: null }, error: null })) })) })) })),
    }));
    const result = await resolveProviderCredential({ provider: "upstox", credentialType: "access_token", capability: "upstox-http" });
    expect(result.value).toBeNull();
    expect(result.status).toBe("INVALID");
    expect(result.source).toBe("DATABASE");
    expect(result.failureReason).toBe("DECRYPTION_FAILED");
  });

  it("validates telegram credentials without leaking raw values", async () => {
    const result = await testProviderCredential({ provider: "telegram", credentialType: "bot_token", value: "123456:ABC-XYZ" });
    expect(result.status).toBe("READY");
    expect(result.maskedValue).toBe("••••••");
  });
});
