import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/auth/require-supabase-auth";

export const getProviderDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("forbidden");

    const { buildProviderDiagnosticsReport, buildProviderDiagnosticsFailureReport } = await import(
      "./provider-diagnostics.server"
    );
    try {
      return await buildProviderDiagnosticsReport();
    } catch (error) {
      return buildProviderDiagnosticsFailureReport(error);
    }
  });
