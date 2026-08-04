# Phase 66 - Durable Decision History Persistence Verification

## Migration

Filename:

```text
supabase/migrations/20260801000100_phase65_decision_history_persistence.sql
```

Expected tables:

- `public.decision_history_runs`
- `public.decision_history_outcomes`
- `public.decision_history_market_snapshots`
- `public.decision_history_lifecycle_executions`

Expected indexes:

- `decision_history_runs_timestamp_idx`
- `decision_history_runs_instrument_idx`
- `decision_history_outcomes_evaluated_idx`
- `decision_history_outcomes_state_idx`
- `decision_history_market_snapshots_lookup_idx`
- `decision_history_market_snapshots_provider_idx`
- `decision_history_lifecycle_executions_completed_idx`

## Deployment Command

Use the existing Supabase deployment workflow from an authenticated operator environment:

```bash
supabase db push
```

Do not paste or print Supabase URLs, service-role keys, access tokens, or database passwords in logs or tickets.

## Type Regeneration

After the migration is deployed, regenerate Supabase types using the project-approved Supabase CLI flow:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

If the project uses a non-linked local workflow, generate from the authenticated project reference in the operator shell without recording credentials in repository files.

## Verification SQL

Run these statements in a trusted admin SQL console after deployment:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'decision_history_runs',
    'decision_history_outcomes',
    'decision_history_market_snapshots',
    'decision_history_lifecycle_executions'
  )
order by table_name;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'decision_history_runs',
    'decision_history_outcomes',
    'decision_history_market_snapshots',
    'decision_history_lifecycle_executions'
  )
order by indexname;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'decision_history_%'
order by tablename;

select grantee, privilege_type, table_name
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'decision_history_%'
order by table_name, grantee, privilege_type;
```

Expected security posture:

- RLS enabled on every decision-history table.
- `anon`, `authenticated`, and `PUBLIC` have no direct table privileges.
- `service_role` has table privileges for trusted server-side repository operations.

## Post-Deploy Smoke Test

1. Deploy migration.
2. Regenerate Supabase types.
3. Run `npx vitest run src/lib/decision-history`.
4. Run `npm run build`.
5. Open `/admin/system-status` as an admin.
6. Confirm Decision History shows:
   - Persistence Provider: `SUPABASE`
   - Persistence Durability: `DURABLE`
   - Migration Expected: `20260801000100_phase65_decision_history_persistence.sql`
   - Generated Types Ready: `YES`
   - Schema Alignment: `VALID`
   - Repository Hydration: `READY`
   - Persistence Ready: `YES`

## Rollback Approach

Take a database backup before applying the migration. If rollback is required before any production records are written, drop the Phase 65 tables in reverse dependency order from an admin SQL console. If production records exist, export the table data before any destructive action and coordinate an application maintenance window.

```sql
-- Use only after backup/export and maintenance approval.
drop table if exists public.decision_history_lifecycle_executions;
drop table if exists public.decision_history_market_snapshots;
drop table if exists public.decision_history_outcomes;
drop table if exists public.decision_history_runs;
```

## Production Scheduler Activation Gap

Automatic production evaluation should remain inactive until the migration is deployed, generated types are regenerated, `/admin/system-status` reports Persistence Ready, and a manual lifecycle smoke test confirms persisted snapshots and outcomes survive process restart.
