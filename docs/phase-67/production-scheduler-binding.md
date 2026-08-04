# Phase 67 - Production Scheduler Binding and Activation Gate

## Selected Runtime

Current repository evidence supports `MANUAL_ONLY` by default.

No committed Cloudflare scheduled-event binding, Supabase cron definition, external HTTP cron deployment contract, or Wrangler scheduled trigger configuration was found in the focused scheduler/runtime audit. Automatic evaluation must therefore remain inactive until a deployment scheduler binding is added and verified by an operator.

## Existing Infrastructure Reused

- `src/lib/decision-history/lifecycle-runner.server.ts` remains the only lifecycle orchestration entry point.
- `src/lib/decision-history/lifecycle-registration.server.ts` owns scheduler capability classification and activation gating.
- `src/lib/decision-history/lifecycle.functions.ts` preserves the admin-only manual trigger.
- `src/lib/decision-history/diagnostics.ts` and `/admin/system-status` expose aggregate-safe readiness fields.
- Phase 65 Supabase persistence remains a prerequisite.

## Activation Configuration

A production scheduler may register only when all of the following are true:

- durable persistence is ready,
- a supported scheduler runtime is explicitly selected,
- a scheduler binding is detected by deployment code,
- scheduler execution is enabled,
- configuration is valid,
- the lifecycle runner is callable.

Default behavior is fail-closed. Local development and test runtimes remain disabled unless explicitly injected by tests or an operator-only server path.

## Manual Fallback

The admin-only manual trigger remains available through the existing server function. Manual executions are labelled with a `manual-decision-lifecycle::` execution ID and do not set Automatic Evaluation Active.

## Market-Closed Behavior

The scheduler adapter performs deterministic weekday/session-window checks before invoking provider-backed snapshot ingestion. Weekends and times outside the NSE weekday session window return `NO_WORK` with a market-closed reason, keep pending runs pending, and do not create outcomes.

No new exchange holiday calendar was invented in this phase. Holiday-calendar support remains pending until an authoritative project source is available.

## Retry Policy

Retry is allowed only for transient classes such as provider unavailable, repository unavailable, temporary network failure, or equivalent safe transient errors. Retry is not allowed for market closed, no work, snapshot rejection, invalid configuration, existing outcomes, or unsupported runtime.

Backoff is bounded exponential with a maximum of 60 seconds.

## Deployment Steps Requiring Human Execution

1. Deploy the Phase 65 migration and verify `/admin/system-status` reports Persistence Ready.
2. Add a real deployment scheduler binding, such as a Cloudflare scheduled worker, Supabase cron, or authenticated external HTTP cron, using the selected production platform contract.
3. Have the binding call the server-only scheduler adapter, not client code.
4. Keep scheduler credentials outside the repository and logs.
5. Run a manual lifecycle smoke test.
6. Enable scheduler configuration.
7. Confirm `/admin/system-status` reports Scheduler Binding Detected, Scheduler Enabled, and Automatic Evaluation Active only after the binding is verified.

## Disable And Rollback

Disable scheduler configuration first. Pending runs remain pending. Durable records should not be deleted during scheduler rollback unless a separate database rollback has been approved and backed up.

## Monitoring Fields

Monitor the Decision History section for Scheduler Runtime, Scheduler Binding Detected, Scheduler Enabled, Scheduler Registration Status, Automatic Evaluation Active, Last Scheduled Execution, Last Scheduled Result, Last Scheduled Duration, Next Expected Execution, In-Flight, Retry Count, Last Safe Warning, Persistence Ready, and Activation Blockers.

No raw provider payloads, authorization headers, cookies, tokens, API keys, service-role values, or secrets belong in scheduler diagnostics.
