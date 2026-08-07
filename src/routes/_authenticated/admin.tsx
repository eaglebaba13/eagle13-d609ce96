import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-only route boundary.
 *
 * Normal research routes are public. Admin routes remain authenticated
 * and require the authoritative Supabase admin role.
 *
 * Sensitive admin server functions retain their own server-side
 * requireSupabaseAuth / has_role checks as defense in depth.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      throw redirect({ to: "/" });
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });

    if (roleError || isAdmin !== true) {
      throw redirect({ to: "/" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
