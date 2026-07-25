// Phase 48 — Canonical release metadata source.
//
// Reads Vite-injected build-time env vars. Missing values render as
// "NOT INJECTED" (never fabricated timestamps or "dev"/"local"). Consumed
// by the public /status page and admin System Status console so both
// surfaces show identical provenance.

export const NOT_INJECTED = "NOT INJECTED" as const;

export interface ReleaseMetadata {
  readonly version: string;
  readonly buildId: string;
  readonly commitSha: string;
  readonly deployedAt: string;
  readonly channel: string;
  readonly environment: string;
}

function read(name: string): string {
  const raw = (import.meta.env as Record<string, string | undefined>)[name];
  const v = typeof raw === "string" ? raw.trim() : "";
  return v.length > 0 ? v : NOT_INJECTED;
}

export function getReleaseMetadata(): ReleaseMetadata {
  return {
    version: read("VITE_BUILD_VERSION"),
    buildId: read("VITE_BUILD_ID"),
    commitSha: read("VITE_GIT_COMMIT"),
    deployedAt: read("VITE_DEPLOYED_AT"),
    channel: read("VITE_RELEASE_CHANNEL"),
    environment: read("VITE_DEPLOY_ENV"),
  };
}

export const RELEASE_VERDICT = "READY FOR CLOSED BETA" as const;