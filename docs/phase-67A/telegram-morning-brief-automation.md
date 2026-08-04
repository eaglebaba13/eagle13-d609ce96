# Phase 67A - Telegram Morning Brief Automation Repair

## Current Runtime

The repository contains a public morning-brief hook at:

```text
/api/public/hooks/morning-brief
```

The hook is designed for an external scheduler at 08:15 Asia/Kolkata, but no committed production cron binding, Cloudflare scheduled event, Supabase cron registration, or other deployment scheduler contract was found in the focused audit. Automatic Telegram delivery must therefore report `AUTOMATION_INACTIVE` until an operator wires a real scheduler.

## Required Production Binding

A production scheduler must invoke the existing server route with the approved request authentication pattern. Do not add a browser timer or client-side Telegram call.

Operator-owned configuration must remain outside the repository. Logs and tickets must not include Telegram tokens, chat IDs, authorization headers, cookies, Supabase service-role values, or raw provider responses.

## Manual Fallback

The authenticated admin Retry delivery action now retries the latest persisted report only. It returns `NO_REPORT` when there is no persisted report and does not silently regenerate the report.

## Diagnostics

The Multi-Asset Intelligence page exposes aggregate-safe diagnostics:

- Morning Brief Generator Status
- Telegram Configuration Status
- Latest Report Status
- Latest Report Generated At
- Latest Delivery Status
- Latest Delivery Attempt
- Latest Delivery Success
- Delivery Retry Count
- Scheduler Runtime
- Scheduler Registration Status
- Automatic Delivery Active
- Last Safe Error
- Market Session State
- Persistence Status

Diagnostics expose only safe statuses such as `READY`, `CONFIG_MISSING`, `DISABLED`, `NO_REPORT`, and `AUTOMATION_INACTIVE`.

## Market Closed Policy

Weekends and outside-session windows are treated as market closed, not provider failure. No holiday calendar was invented in this phase.

## Smoke Test

1. Confirm Telegram configuration through runtime diagnostics only.
2. Generate a morning brief using the existing public hook from an approved scheduler/operator environment.
3. Confirm `morning_reports` has a latest row.
4. Use admin Retry delivery only if the latest row is failed, partial, pending, or config-missing.
5. Confirm diagnostics do not expose report payloads, tokens, chat IDs, headers, cookies, or raw Telegram responses.

## Disable Procedure

Disable the external scheduler binding or Telegram/morning-brief enabled flag. Existing reports remain persisted; no broker or trading action is involved.
