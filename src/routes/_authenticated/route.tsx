import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { clientLocalBypassActive, localDevIdentity } from "@/lib/local-dev-auth";

/**
 * Protected subtree. `ssr: false` because Supabase stores its session in
 * localStorage — the server can't see it, so we gate client-side and let
 * unauthenticated users bounce to `/auth`.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Phase 52D — localhost development bypass (never active in production).
    if (clientLocalBypassActive()) {
      const identity = localDevIdentity();
      return { user: { id: identity.userId, email: identity.email } as never };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});