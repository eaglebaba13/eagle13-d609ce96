import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/auth/require-supabase-auth";
import { runManualDecisionOutcomeLifecycle } from "./lifecycle-registration.server";
import type { LifecycleExecutionSummary } from "./lifecycle-execution-history";

export const runManualDecisionOutcomeLifecycleExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LifecycleExecutionSummary> => {
    let isAdmin = false;
    try {
      const { data } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      isAdmin = data === true;
    } catch {
      isAdmin = false;
    }
    if (!isAdmin) throw new Error("Admin role required.");
    return runManualDecisionOutcomeLifecycle();
  });

