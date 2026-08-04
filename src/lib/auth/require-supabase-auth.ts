/**
 * Phase 52D — Project-owned auth middleware.
 *
 * Drop-in replacement for the generated `requireSupabaseAuth` that adds a
 * localhost-only development bypass. In production (or on any non-local host,
 * or without the explicit LOCAL_DEV_AUTH_BYPASS flag) the behaviour is the
 * same bearer-token validation as before.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { JwtPayload } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isServerLocalBypassEnabled, localDevIdentity } from "@/lib/local-dev-auth";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function readSupabaseEnv() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }
  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const host = request?.headers?.get("host") ?? null;

    // ---- Localhost-only development bypass -------------------------------
    if (
      isServerLocalBypassEnabled({
        nodeEnv: process.env.NODE_ENV,
        host,
        flag: process.env.LOCAL_DEV_AUTH_BYPASS,
      })
    ) {
      const identity = localDevIdentity();
      const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = readSupabaseEnv();
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      return next({
        context: {
          supabase,
          userId: identity.userId,
          claims: {
            sub: identity.userId,
            email: identity.email,
            role: identity.role,
            local_dev_bypass: true,
          } as unknown as JwtPayload,
          localDevBypass: true,
        },
      });
    }

    // ---- Production / non-local: unchanged bearer validation --------------
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = readSupabaseEnv();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }
    if (token.split(".").length !== 3) {
      throw new Error("Unauthorized: Invalid token");
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      throw new Error("Unauthorized: Invalid token");
    }
    if (!data.claims.sub) {
      throw new Error("Unauthorized: No user ID found in token");
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
        localDevBypass: false,
      },
    });
  },
);
