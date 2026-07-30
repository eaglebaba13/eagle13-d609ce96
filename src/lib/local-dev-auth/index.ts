/**
 * Phase 52D — Localhost-only authentication bypass.
 *
 * Pure, dependency-free predicates so both the server middleware and the
 * browser auth context agree on exactly one definition of "local dev".
 *
 * SECURITY: the bypass is hard-gated on a non-production NODE_ENV *and* a
 * localhost hostname *and* an explicit opt-in flag. Setting
 * LOCAL_DEV_AUTH_BYPASS=true in production is deliberately ignored.
 */
import type { AppRole } from "../roles";

export const LOCAL_DEV_USER_ID = "local-dev-admin";
export const LOCAL_DEV_ROLE: AppRole = "admin";
export const LOCAL_DEV_EMAIL = "local@localhost";
export const LOCAL_DEV_DISPLAY_NAME = "Local Admin";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

/** Accepts a bare hostname, `host:port`, or a full URL/Host header value. */
export function isLocalHostname(hostLike: string | null | undefined): boolean {
  if (!hostLike) return false;
  let value = hostLike.trim().toLowerCase();
  if (value.includes("://")) value = value.slice(value.indexOf("://") + 3);
  value = value.split("/")[0];
  // Strip port (keep bracketed IPv6 intact).
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end !== -1) value = value.slice(0, end + 1);
  } else if (value.includes(":")) {
    value = value.split(":")[0];
  }
  return LOCAL_HOSTNAMES.has(value);
}

export function isTruthyFlag(value: string | undefined | null): boolean {
  if (!value) return false;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

export interface ServerBypassInput {
  nodeEnv: string | undefined;
  host: string | null | undefined;
  flag: string | undefined;
}

/** Server-side gate for `requireSupabaseAuth`. */
export function isServerLocalBypassEnabled({ nodeEnv, host, flag }: ServerBypassInput): boolean {
  if (nodeEnv === "production") return false;
  if (!isTruthyFlag(flag)) return false;
  return isLocalHostname(host);
}

/** Browser-side gate for the auth context / profile menu. */
export function isClientLocalBypassEnabled(input: {
  dev: boolean;
  hostname: string | null | undefined;
}): boolean {
  if (!input.dev) return false;
  return isLocalHostname(input.hostname);
}

export interface LocalDevIdentity {
  userId: string;
  role: AppRole;
  email: string;
  displayName: string;
  authenticated: true;
}

export function localDevIdentity(): LocalDevIdentity {
  return {
    userId: LOCAL_DEV_USER_ID,
    role: LOCAL_DEV_ROLE,
    email: LOCAL_DEV_EMAIL,
    displayName: LOCAL_DEV_DISPLAY_NAME,
    authenticated: true,
  };
}

/** Runtime helper for browser code (SSR-safe). */
export function clientLocalBypassActive(): boolean {
  if (typeof window === "undefined") return false;
  const dev = Boolean(
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV,
  );
  return isClientLocalBypassEnabled({ dev, hostname: window.location.hostname });
}