// Phase 44B — Public cron hook that triggers the morning brief.
// Called by pg_cron at 02:45 UTC (08:15 IST). Authenticated by the standard
// Supabase anon apikey header, matching the pattern documented in the
// scheduler knowledge card.

import { createFileRoute } from "@tanstack/react-router";
import { runMorningBrief } from "@/lib/multi-asset/report.functions";

function safeError(message: string): string {
  return message.replace(/token|secret|authorization|cookie|api[-_]?key|bearer|chat[_ -]?id/gi, "[REDACTED]").slice(0, 160);
}
function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401, headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/morning-brief")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apikey !== expected) return unauthorized();
        const url = new URL(request.url);
        const forceRebuild = url.searchParams.get("rebuild") === "1";
        const forceRedeliver = url.searchParams.get("redeliver") === "1" || forceRebuild;
        try {
          const record = await runMorningBrief({ forceRebuild, forceRedeliver });
          return Response.json({
            ok: true,
            reportId: record.payload.reportId,
            deliveryStatus: record.deliveryStatus,
            deliveryAttempts: record.deliveryAttempts,
            attempted: record.telegramMessageIds.length,
          });
        } catch (err) {
          return Response.json(
            { ok: false, error: safeError(err instanceof Error ? err.message : String(err)) },
            { status: 500 },
          );
        }
      },
    },
  },
});
