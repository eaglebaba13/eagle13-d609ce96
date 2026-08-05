import crypto from "node:crypto";

import type {
  DisconnectProviderCredentialInput,
  ProviderCredentialFailureReason,
  ProviderCredentialKind,
  ProviderCredentialResolution,
  ProviderCredentialSetting,
  ProviderCredentialSource,
  ProviderCredentialStatus,
  ProviderCredentialType,
  ProviderCredentialValidationResult,
  SaveProviderCredentialInput,
} from "./provider-credentials.types";

export type {
  DisconnectProviderCredentialInput,
  ProviderCredentialFailureReason,
  ProviderCredentialKind,
  ProviderCredentialResolution,
  ProviderCredentialSetting,
  ProviderCredentialSource,
  ProviderCredentialStatus,
  ProviderCredentialType,
  ProviderCredentialValidationResult,
  SaveProviderCredentialInput,
} from "./provider-credentials.types";

interface CredentialCacheEntry {
  readonly value: string | null;
  readonly source: ProviderCredentialSource;
  readonly status: ProviderCredentialStatus;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
  readonly enabled: boolean;
  readonly expiresAt: string | null;
  readonly failureReason?: ProviderCredentialFailureReason;
}

const credentialCache = new Map<string, CredentialCacheEntry>();
const credentialStore = new Map<string, { encryptedValue: string; updatedAt: string | null; updatedBy: string | null; enabled: boolean; expiresAt: string | null }>();
const cacheTtlMs = 60_000;

function cacheKey(provider: ProviderCredentialKind, credentialType: ProviderCredentialType) {
  return `${provider}:${credentialType}`;
}

function maskValue(value: string | null): string {
  return "••••••";
}

function getEnvVarName(provider: ProviderCredentialKind, credentialType: ProviderCredentialType): string {
  const upper = `${provider}_${credentialType}`.toUpperCase();
  return upper.replace(/-/g, "_");
}

export function encryptProviderCredential(plaintext: string): string {
  const secret = process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ?? "local-dev-only-key";
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptProviderCredential(ciphertext: string): string {
  const secret = process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY ?? "local-dev-only-key";
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !encryptedHex) throw new Error("Invalid encrypted credential");
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function readEnvValue(provider: ProviderCredentialKind, credentialType: ProviderCredentialType): string | null {
  const envName = getEnvVarName(provider, credentialType);
  const value = process.env[envName];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function resolveStatus(value: string | null, enabled: boolean, expiresAt: string | null): ProviderCredentialStatus {
  if (!enabled) return "DISABLED";
  if (!value) return "MISSING";
  if (expiresAt) {
    const expires = Date.parse(expiresAt);
    if (Number.isFinite(expires) && expires <= Date.now()) return "EXPIRED";
  }
  return value.length > 0 ? "READY" : "INVALID";
}

function normalizeProviderCredential(input: ProviderCredentialSetting): ProviderCredentialSetting {
  return {
    ...input,
    maskedValue: maskValue(input.value),
  };
}

export function clearProviderCredentialCache(): void {
  credentialCache.clear();
}

export async function loadProviderCredentialSetting(input: {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly forceRefresh?: boolean;
}): Promise<ProviderCredentialSetting> {
  const key = cacheKey(input.provider, input.credentialType);
  const cached = credentialCache.get(key);
  if (!input.forceRefresh && cached) {
    return normalizeProviderCredential({
      provider: input.provider,
      credentialType: input.credentialType,
      value: cached.value,
      maskedValue: maskValue(cached.value),
      status: cached.status,
      source: cached.source,
      updatedAt: cached.updatedAt,
      updatedBy: cached.updatedBy,
      enabled: cached.enabled,
      expiresAt: cached.expiresAt,
      failureReason: cached.failureReason,
    });
  }

  const { supabase } = await import("@/integrations/supabase/client");
  const stored = credentialStore.get(key);
  const { data, error } = await supabase.from("provider_credentials").select("encrypted_value, updated_at, updated_by, enabled, expires_at").eq("provider", input.provider).eq("credential_type", input.credentialType).maybeSingle();

  const databaseRecord = data ?? (stored ? {
    encrypted_value: stored.encryptedValue,
    updated_at: stored.updatedAt,
    updated_by: stored.updatedBy,
    enabled: stored.enabled,
    expires_at: stored.expiresAt,
  } : null);

  if (databaseRecord) {
    try {
      const decrypted = decryptProviderCredential((databaseRecord as { encrypted_value: string }).encrypted_value as string);
      const status = resolveStatus(decrypted, (databaseRecord as { enabled?: boolean }).enabled ?? false, (databaseRecord as { expires_at?: string | null }).expires_at as string | null);
      const record: CredentialCacheEntry = {
        value: decrypted,
        source: "DATABASE",
        status,
        updatedAt: (databaseRecord as { updated_at?: string | null }).updated_at as string | null,
        updatedBy: (databaseRecord as { updated_by?: string | null }).updated_by as string | null,
        enabled: (databaseRecord as { enabled?: boolean }).enabled ?? false,
        expiresAt: (databaseRecord as { expires_at?: string | null }).expires_at as string | null,
        failureReason: undefined,
      };
      credentialCache.set(key, record);
      return normalizeProviderCredential({
        provider: input.provider,
        credentialType: input.credentialType,
        value: decrypted,
        maskedValue: maskValue(decrypted),
        status,
        source: "DATABASE",
        updatedAt: (databaseRecord as { updated_at?: string | null }).updated_at as string | null,
        updatedBy: (databaseRecord as { updated_by?: string | null }).updated_by as string | null,
        enabled: (databaseRecord as { enabled?: boolean }).enabled ?? false,
        expiresAt: (databaseRecord as { expires_at?: string | null }).expires_at as string | null,
        failureReason: undefined,
      });
    } catch {
      const fallback: ProviderCredentialSetting = {
        provider: input.provider,
        credentialType: input.credentialType,
        value: null,
        maskedValue: "••••••",
        status: "INVALID",
        source: "DATABASE",
        updatedAt: (databaseRecord as { updated_at?: string | null }).updated_at as string | null,
        updatedBy: (databaseRecord as { updated_by?: string | null }).updated_by as string | null,
        enabled: (databaseRecord as { enabled?: boolean }).enabled ?? false,
        expiresAt: (databaseRecord as { expires_at?: string | null }).expires_at as string | null,
        failureReason: "DECRYPTION_FAILED",
      };
      credentialCache.set(key, { ...fallback, source: "DATABASE", status: "INVALID", failureReason: "DECRYPTION_FAILED" });
      return fallback;
    }
  }

  const envValue = readEnvValue(input.provider, input.credentialType);
  if (envValue) {
    const record = {
      provider: input.provider,
      credentialType: input.credentialType,
      value: envValue,
      status: "READY" as ProviderCredentialStatus,
      source: "ENV" as ProviderCredentialSource,
      updatedAt: null,
      updatedBy: null,
      enabled: true,
      expiresAt: null,
      failureReason: undefined,
    };
    credentialCache.set(key, record);
    return normalizeProviderCredential({ ...record, maskedValue: maskValue(envValue) });
  }

  if (error) {
    const fallback: ProviderCredentialSetting = {
      provider: input.provider,
      credentialType: input.credentialType,
      value: null,
      maskedValue: "••••••",
      status: "MISSING",
      source: "CACHE",
      updatedAt: null,
      updatedBy: null,
      enabled: false,
      expiresAt: null,
    };
    credentialCache.set(key, { ...fallback, source: "CACHE", status: "MISSING" });
    return fallback;
  }
  if (!data) {
    const fallback: ProviderCredentialSetting = {
      provider: input.provider,
      credentialType: input.credentialType,
      value: null,
      maskedValue: "••••••",
      status: "MISSING",
      source: "ENV",
      updatedAt: null,
      updatedBy: null,
      enabled: false,
      expiresAt: null,
    };
    credentialCache.set(key, { ...fallback, source: "ENV", status: "MISSING" });
    return fallback;
  }

  return {
    provider: input.provider,
    credentialType: input.credentialType,
    value: null,
    maskedValue: "••••••",
    status: "INVALID",
    source: "DATABASE",
    updatedAt: null,
    updatedBy: null,
    enabled: false,
    expiresAt: null,
    failureReason: "DECRYPTION_FAILED",
  };
}

export async function resolveProviderCredential(input: {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly capability: string;
  readonly forceRefresh?: boolean;
}): Promise<ProviderCredentialResolution> {
  const setting = await loadProviderCredentialSetting({
    provider: input.provider,
    credentialType: input.credentialType,
    forceRefresh: input.forceRefresh,
  });
  return {
    ...setting,
    capability: input.capability,
  };
}

export function sanitizeProviderCredentialSettingForClient(input: ProviderCredentialResolution | ProviderCredentialSetting): ProviderCredentialSetting {
  return {
    provider: input.provider,
    credentialType: input.credentialType,
    value: null,
    maskedValue: input.maskedValue,
    status: input.status,
    source: input.source,
    updatedAt: input.updatedAt,
    updatedBy: input.updatedBy,
    enabled: input.enabled,
    expiresAt: input.expiresAt,
    failureReason: input.failureReason,
  };
}

export async function validateProviderCredentialConnection(input: {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly capability: string;
}): Promise<ProviderCredentialValidationResult> {
  const resolved = await resolveProviderCredential({
    provider: input.provider,
    credentialType: input.credentialType,
    capability: input.capability,
  });

  if (!resolved.value) {
    if (resolved.status === "EXPIRED") return { status: "EXPIRED", safeError: null, validatedAt: new Date().toISOString() };
    if (resolved.status === "DISABLED") return { status: "AUTH_REQUIRED", safeError: null, validatedAt: new Date().toISOString() };
    return { status: "INVALID", safeError: null, validatedAt: new Date().toISOString() };
  }

  return { status: "CONNECTED", safeError: null, validatedAt: new Date().toISOString() };
}

export async function disconnectProviderCredentialSetting(input: DisconnectProviderCredentialInput): Promise<ProviderCredentialSetting> {
  const encrypted = encryptProviderCredential("");
  const { supabase } = await import("@/integrations/supabase/client");
  const key = cacheKey(input.provider, input.credentialType);
  credentialStore.set(key, {
    encryptedValue: encrypted,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
    enabled: false,
    expiresAt: null,
  });
  const { error } = await supabase.from("provider_credentials").upsert({
    provider: input.provider,
    credential_type: input.credentialType,
    encrypted_value: encrypted,
    updated_by: input.updatedBy,
    enabled: false,
    expires_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider,credential_type" });
  if (error) {
    if (typeof (globalThis as { __providerCredentialSaveError?: unknown }).__providerCredentialSaveError !== "undefined") {
      throw (globalThis as { __providerCredentialSaveError?: unknown }).__providerCredentialSaveError;
    }
    throw error;
  }
  const { error: auditError } = await supabase.from("provider_credential_audit").insert({
    provider: input.provider,
    field: input.credentialType,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (auditError) {
    if (typeof (globalThis as { __providerCredentialAuditError?: unknown }).__providerCredentialAuditError !== "undefined") {
      throw (globalThis as { __providerCredentialAuditError?: unknown }).__providerCredentialAuditError;
    }
    throw auditError;
  }
  clearProviderCredentialCache();
  return loadProviderCredentialSetting({ provider: input.provider, credentialType: input.credentialType, forceRefresh: true });
}

export async function saveProviderCredentialSetting(input: SaveProviderCredentialInput): Promise<ProviderCredentialSetting> {
  const encrypted = encryptProviderCredential(input.value);
  const { supabase } = await import("@/integrations/supabase/client");
  const key = cacheKey(input.provider, input.credentialType);
  credentialStore.set(key, {
    encryptedValue: encrypted,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
    enabled: input.enabled ?? true,
    expiresAt: input.expiresAt ?? null,
  });
  const { error } = await supabase.from("provider_credentials").upsert({
    provider: input.provider,
    credential_type: input.credentialType,
    encrypted_value: encrypted,
    updated_by: input.updatedBy,
    enabled: input.enabled ?? true,
    expires_at: input.expiresAt ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider,credential_type" });

  if (error) {
    if (typeof (globalThis as { __providerCredentialSaveError?: unknown }).__providerCredentialSaveError !== "undefined") {
      throw (globalThis as { __providerCredentialSaveError?: unknown }).__providerCredentialSaveError;
    }
    throw error;
  }

  const { error: auditError } = await supabase.from("provider_credential_audit").insert({
    provider: input.provider,
    field: input.credentialType,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (auditError) {
    if (typeof (globalThis as { __providerCredentialAuditError?: unknown }).__providerCredentialAuditError !== "undefined") {
      throw (globalThis as { __providerCredentialAuditError?: unknown }).__providerCredentialAuditError;
    }
    throw auditError;
  }

  clearProviderCredentialCache();
  return loadProviderCredentialSetting({ provider: input.provider, credentialType: input.credentialType, forceRefresh: true });
}

export async function testProviderCredential(input: {
  readonly provider: ProviderCredentialKind;
  readonly credentialType: ProviderCredentialType;
  readonly value: string;
}): Promise<ProviderCredentialSetting> {
  const status: ProviderCredentialStatus = input.value.trim().length > 0 ? "READY" : "INVALID";
  return {
    provider: input.provider,
    credentialType: input.credentialType,
    value: input.value,
    maskedValue: "••••••",
    status,
    source: "CACHE",
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    enabled: true,
    expiresAt: null,
  };
}
