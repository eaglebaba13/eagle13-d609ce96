// Phase 31 — Admin System Status console.
//
// Read-only aggregation of pipeline definition, environment status,
// health composer, backup readiness, and security posture. This page
// does NOT trigger deploys; it visualises pre-computed policy.

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { PRODUCTION_PIPELINE } from "@/lib/ci-cd-pipeline";
import { DEFAULT_ENV_REQUIREMENTS } from "@/lib/env-validation";
import { RECOVERY_CHECKLIST } from "@/lib/backup-recovery";
import { MIGRATION_CHECKLIST, ROLLBACK_CHECKLIST } from "@/lib/release-management";
import { REQUIRED_SECURITY_HEADERS } from "@/lib/security-audit";
import { RuntimeReadinessSummary } from "@/components/runtime-readiness";
import { useRuntimeReadinessQuery } from "@/lib/runtime-readiness/use-runtime-readiness";
import { getReleaseMetadata, RELEASE_VERDICT } from "@/lib/release-metadata";
import { getDecisionHistoryDiagnostics } from "@/lib/decision-history/diagnostics";

export const Route = createFileRoute("/_authenticated/admin/system-status")({
  head: () => ({
    meta: [
      { title: "System Status — EagleBABA" },
      {
        name: "description",
        content:
          "Admin-only deployment, environment, backup and security posture overview for the EagleBABA Astro Research Platform.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SystemStatusPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/40 bg-card/40 p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const decisionHistoryQuery = () =>
  queryOptions({
    queryKey: ["decision-history-diagnostics"],
    queryFn: () => getDecisionHistoryDiagnostics(),
  });

function SystemStatusPage() {
  const meta = getReleaseMetadata();
  const buildVersion = meta.version;
  const gitCommit = meta.commitSha;
  const deployedAt = meta.deployedAt;
  void RELEASE_VERDICT;

  const rq = useRuntimeReadinessQuery();
  const report = rq.data ?? null;
  const error = rq.error ? rq.error.message : null;
  const diagnostics = useSuspenseQuery(decisionHistoryQuery()).data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">System Status</h1>
        <p className="text-sm text-muted-foreground">
          Phase 31 · deployment framework overview. Research engines, formulas
          and broker paths are intentionally excluded from this surface.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          Runtime readiness: {error}
        </div>
      )}
      {report && <RuntimeReadinessSummary report={report} title="Canonical Runtime Readiness" />}

      <Section title="Decision History">
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Repository</dt>
            <dd>{diagnostics.repositoryType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Durability</dt>
            <dd>{diagnostics.durability}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stored runs</dt>
            <dd>{diagnostics.totalRuns}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stored outcomes</dt>
            <dd>{diagnostics.storedOutcomes}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Evaluated outcomes</dt>
            <dd>{diagnostics.evaluatedOutcomes}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pending outcomes</dt>
            <dd>{diagnostics.pendingRuns}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cancelled runs</dt>
            <dd>{diagnostics.cancelledOutcomes}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Win rate</dt>
            <dd>{diagnostics.winRatePct == null ? "NO_DATA" : `${diagnostics.winRatePct.toFixed(1)}%`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Loss rate</dt>
            <dd>{diagnostics.lossRatePct == null ? "NO_DATA" : `${diagnostics.lossRatePct.toFixed(1)}%`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Neutral rate</dt>
            <dd>{diagnostics.neutralRatePct == null ? "NO_DATA" : `${diagnostics.neutralRatePct.toFixed(1)}%`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Average confidence</dt>
            <dd>{diagnostics.averageConfidence == null ? "NO_DATA" : diagnostics.averageConfidence.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Average evaluation time</dt>
            <dd>{diagnostics.averageEvaluationTimeMs == null ? "NO_DATA" : `${Math.round(diagnostics.averageEvaluationTimeMs / 60000)}m`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pending queue</dt>
            <dd>{diagnostics.pendingQueue}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Evaluated queue</dt>
            <dd>{diagnostics.evaluatedQueue}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Skipped queue</dt>
            <dd>{diagnostics.skippedQueue}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler status</dt>
            <dd>{diagnostics.schedulerStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last evaluation time</dt>
            <dd>{diagnostics.lastEvaluationTime ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler avg duration</dt>
            <dd>{diagnostics.averageSchedulerEvaluationDurationMs == null ? "NO_DATA" : `${diagnostics.averageSchedulerEvaluationDurationMs.toFixed(0)}ms`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Repository health</dt>
            <dd>{diagnostics.repositoryHealth}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stored market snapshots</dt>
            <dd>{diagnostics.storedMarketSnapshots}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Verified market snapshots</dt>
            <dd>{diagnostics.verifiedMarketSnapshots}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rejected snapshots</dt>
            <dd>{diagnostics.rejectedSnapshotCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Oldest verified snapshot</dt>
            <dd>{diagnostics.oldestVerifiedSnapshot ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Newest verified snapshot</dt>
            <dd>{diagnostics.newestVerifiedSnapshot ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Snapshot instruments</dt>
            <dd>{diagnostics.instrumentsCovered.join(", ") || "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Snapshot capacity</dt>
            <dd>{diagnostics.snapshotRepositoryCapacity}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Snapshot repository</dt>
            <dd>{diagnostics.snapshotRepositoryType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Snapshot durability</dt>
            <dd>{diagnostics.snapshotDurability}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler snapshot source</dt>
            <dd>{diagnostics.schedulerSnapshotSource}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler snapshot ready</dt>
            <dd>{diagnostics.schedulerSnapshotReady ? "YES" : "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last snapshot ingested</dt>
            <dd>{diagnostics.lastSnapshotIngestedAt ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last snapshot rejection</dt>
            <dd>{diagnostics.lastSnapshotRejectionReason ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lifecycle Runner Status</dt>
            <dd>{diagnostics.lifecycleRunnerStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler Runtime</dt>
            <dd>{diagnostics.schedulerRuntime}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler Binding Detected</dt>
            <dd>{diagnostics.schedulerBindingDetected ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler Enabled</dt>
            <dd>{diagnostics.schedulerEnabled ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduler Registration Status</dt>
            <dd>{diagnostics.schedulerRegistrationStatus}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Automatic Evaluation Active</dt>
            <dd>{diagnostics.automaticEvaluationActive ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Next Expected Execution</dt>
            <dd>{diagnostics.nextExpectedExecution ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Activation Blockers</dt>
            <dd>{diagnostics.activationBlockers.join(", ") || "NONE"}</dd>
          </div>          <div>
            <dt className="text-muted-foreground">Last Execution At</dt>
            <dd>{diagnostics.lastExecutionAt ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Execution Duration</dt>
            <dd>{diagnostics.lastExecutionDurationMs == null ? "NO_DATA" : `${diagnostics.lastExecutionDurationMs}ms`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Execution Result</dt>
            <dd>{diagnostics.lastExecutionResult ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total Executions</dt>
            <dd>{diagnostics.totalExecutions}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Successful Executions</dt>
            <dd>{diagnostics.successfulExecutions}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Partial Executions</dt>
            <dd>{diagnostics.partialExecutions}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Failed Executions</dt>
            <dd>{diagnostics.failedExecutions}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Snapshot Attempts</dt>
            <dd>{diagnostics.lastSnapshotAttemptCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Snapshot Stored</dt>
            <dd>{diagnostics.lastSnapshotStoredCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Eligible Runs</dt>
            <dd>{diagnostics.lastEligibleRunCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Evaluated Runs</dt>
            <dd>{diagnostics.lastEvaluatedRunCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Pending Runs</dt>
            <dd>{diagnostics.lastPendingRunCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">In-Flight</dt>
            <dd>{diagnostics.inFlight ? "YES" : "NO"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Retry Count</dt>
            <dd>{diagnostics.retryCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last Safe Warning</dt>
            <dd>{diagnostics.lastSafeWarning ?? "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Execution Repository</dt>
            <dd>{diagnostics.executionRepositoryType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Execution Durability</dt>
            <dd>{diagnostics.executionDurability}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Historical Accuracy Ready</dt>
            <dd>{diagnostics.historicalAccuracyReady ? "YES" : "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Replay Ready</dt>
            <dd>{diagnostics.replayReady ? "YES" : "NO_DATA"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Oldest run</dt>
            <dd>{diagnostics.oldestTimestamp ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Newest run</dt>
            <dd>{diagnostics.newestTimestamp ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Instruments</dt>
            <dd>{diagnostics.instruments.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Retention limit</dt>
            <dd>{diagnostics.retentionLimit}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dropped runs</dt>
            <dd>{diagnostics.droppedRunCount}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Persistence Ready is informational and does not alter canonical runtime readiness. Durable storage requires the expected Supabase migration to be deployed.
        </p>
      </Section>

      <Section title="Build Information">
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-mono">{buildVersion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Git commit</dt>
            <dd className="font-mono">{gitCommit}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deployed at</dt>
            <dd className="font-mono">{deployedAt}</dd>
          </div>
        </dl>
      </Section>

      <Section title="CI/CD Pipeline">
        <ol className="space-y-1 text-sm">
          {PRODUCTION_PIPELINE.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3">
              <span className="w-6 text-muted-foreground">{i + 1}.</span>
              <div>
                <div className="font-medium">
                  {s.label}
                  {!s.blocking && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">non-blocking</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{s.description}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Environment Requirements">
        <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
          {DEFAULT_ENV_REQUIREMENTS.map((r) => (
            <li key={r.key} className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-xs">{r.key}</span>
              <span className="text-xs text-muted-foreground">
                {r.category}
                {r.required ? " · required" : " · optional"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Backup & Recovery Checklist">
        <ul className="space-y-1 text-sm">
          {RECOVERY_CHECKLIST.map((c) => (
            <li key={c.id}>
              <span className="font-medium">{c.label}</span>{" "}
              <span className="text-xs text-muted-foreground">— {c.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Release Management">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Migration checklist</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {MIGRATION_CHECKLIST.map((c) => (
                <li key={c.id}>
                  {c.label}
                  {c.required && <span className="ml-2 text-xs text-amber-300">required</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Rollback checklist</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ROLLBACK_CHECKLIST.map((c) => (
                <li key={c.id}>
                  {c.label}
                  {c.required && <span className="ml-2 text-xs text-amber-300">required</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Security Posture — Required Response Headers">
        <ul className="flex flex-wrap gap-2 text-xs">
          {REQUIRED_SECURITY_HEADERS.map((h) => (
            <li key={h} className="rounded border border-border/40 bg-muted px-2 py-1 font-mono">
              {h}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}





