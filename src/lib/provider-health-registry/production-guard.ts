// Phase 53B — Centralized production guard for demo/mock providers.

import { recordProviderSample } from "./registry";

export const MOCK_BLOCKED_CODE = "MOCK_BLOCKED_IN_PRODUCTION" as const;

export interface ProductionGuardOptions {
  readonly providerId: string;
  readonly label?: string;
  readonly isMock: boolean;
  readonly isProduction?: boolean;
  readonly allowMockOverride?: boolean;
}

export interface ProductionGuardResult {
  readonly allowed: boolean;
  readonly reason:
    | typeof MOCK_BLOCKED_CODE
    | "ALLOWED_LIVE"
    | "ALLOWED_MOCK_DEV"
    | "ALLOWED_MOCK_OVERRIDE";
  readonly mock: boolean;
}

function envFlag(name: string): boolean {
  try {
    const v = (import.meta as unknown as { env?: Record<string, unknown> }).env?.[name];
    return v === true || v === "1" || v === "true";
  } catch {
    return false;
  }
}

function envProd(): boolean {
  try {
    return Boolean((import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD);
  } catch {
    return false;
  }
}

export function assertProductionProvider(opts: ProductionGuardOptions): ProductionGuardResult {
  const isProd = opts.isProduction ?? envProd();
  const override = opts.allowMockOverride ?? envFlag("VITE_ALLOW_MOCK_PROVIDERS");
  if (!opts.isMock) return { allowed: true, reason: "ALLOWED_LIVE", mock: false };
  if (!isProd) return { allowed: true, reason: "ALLOWED_MOCK_DEV", mock: true };
  if (override) return { allowed: true, reason: "ALLOWED_MOCK_OVERRIDE", mock: true };
  recordProviderSample({
    providerId: opts.providerId,
    label: opts.label,
    ok: false,
    latencyMs: 0,
    ageSeconds: 0,
    reason: "UNAVAILABLE",
  });
  return { allowed: false, reason: MOCK_BLOCKED_CODE, mock: true };
}