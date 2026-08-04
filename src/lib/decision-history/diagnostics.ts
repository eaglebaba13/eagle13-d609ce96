import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/auth/require-supabase-auth";
import { defaultDecisionHistoryRepository } from "./repository";
import { redactValue } from "./serializer";
import { getOutcomeSchedulerDiagnostics, type OutcomeSchedulerStatus } from "./outcome-scheduler";
import { defaultLifecycleExecutionRepository } from "./lifecycle-execution-history";
import { getLifecycleRuntimeState } from "./lifecycle-runner.server";
import { getLifecycleSchedulerRegistrationStatus, type LifecycleSchedulerRegistrationStatus, type LifecycleSchedulerRuntime } from "./lifecycle-registration.server";

interface PersistenceReadinessSummary {
  readonly persistenceProvider: "SUPABASE" | "IN_MEMORY";
  readonly persistenceDurability: "DURABLE" | "PROCESS_LIFETIME";
  readonly migrationExpected: string;
  readonly generatedTypesReady: boolean;
  readonly schemaAlignmentStatus: "VALID" | "INVALID";
  readonly repositoryHydrationStatus: "READY" | "UNAVAILABLE";
  readonly persistenceReady: boolean;
  readonly lastPersistenceError: string | null;
}

export interface DecisionHistoryDiagnosticsSummary {
  readonly repositoryType: "IN_MEMORY" | "SUPABASE";
  readonly durability: "PROCESS_LIFETIME" | "DURABLE";
  readonly totalRuns: number;
  readonly oldestTimestamp: string | null;
  readonly newestTimestamp: string | null;
  readonly instruments: readonly string[];
  readonly retentionLimit: number;
  readonly droppedRunCount: number;
  readonly storedOutcomes: number;
  readonly evaluatedOutcomes: number;
  readonly pendingOutcomes: number;
  readonly pendingRuns: number;
  readonly cancelledOutcomes: number;
  readonly winRatePct: number | null;
  readonly lossRatePct: number | null;
  readonly neutralRatePct: number | null;
  readonly averageConfidence: number | null;
  readonly averageEvaluationTimeMs: number | null;
  readonly pendingQueue: number;
  readonly evaluatedQueue: number;
  readonly skippedQueue: number;
  readonly schedulerStatus: OutcomeSchedulerStatus;
  readonly lastEvaluationTime: string | null;
  readonly averageSchedulerEvaluationDurationMs: number | null;
  readonly repositoryHealth: "OK" | "UNAVAILABLE";
  readonly storedMarketSnapshots: number;
  readonly verifiedMarketSnapshots: number;
  readonly rejectedSnapshotCount: number;
  readonly oldestVerifiedSnapshot: string | null;
  readonly newestVerifiedSnapshot: string | null;
  readonly instrumentsCovered: readonly string[];
  readonly snapshotRepositoryCapacity: number;
  readonly snapshotRepositoryType: "IN_MEMORY" | "SUPABASE";
  readonly snapshotDurability: "PROCESS_LIFETIME" | "DURABLE";
  readonly schedulerSnapshotSource: "DECISION_HISTORY_MARKET_SNAPSHOT_REPOSITORY";
  readonly schedulerSnapshotReady: boolean;
  readonly lastSnapshotIngestedAt: string | null;
  readonly lastSnapshotRejectionReason: string | null;
  readonly lifecycleRunnerStatus: "READY" | "BUSY";
  readonly lifecycleReady: boolean;
  readonly schedulerRegistrationStatus: LifecycleSchedulerRegistrationStatus;
  readonly schedulerRuntime: LifecycleSchedulerRuntime;
  readonly schedulerBindingDetected: boolean;
  readonly schedulerEnabled: boolean;
  readonly automaticEvaluationActive: boolean;
  readonly nextExpectedExecution: string | null;
  readonly activationBlockers: readonly string[];
  readonly lastExecutionAt: string | null;
  readonly lastExecutionDurationMs: number | null;
  readonly lastExecutionResult: string | null;
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly partialExecutions: number;
  readonly failedExecutions: number;
  readonly lastSnapshotAttemptCount: number;
  readonly lastSnapshotStoredCount: number;
  readonly lastEligibleRunCount: number;
  readonly lastEvaluatedRunCount: number;
  readonly lastPendingRunCount: number;
  readonly inFlight: boolean;
  readonly retryCount: number;
  readonly lastSafeWarning: string | null;
  readonly executionRepositoryType: "IN_MEMORY" | "SUPABASE";
  readonly executionDurability: "PROCESS_LIFETIME" | "DURABLE";
  readonly historicalAccuracyReady: boolean;
  readonly replayReady: boolean;
  readonly learningReady: boolean;
  readonly lastPersistenceError: string | null;
  readonly persistenceProvider: "SUPABASE" | "IN_MEMORY";
  readonly persistenceDurability: "DURABLE" | "PROCESS_LIFETIME";
  readonly migrationExpected: string;
  readonly generatedTypesReady: boolean;
  readonly schemaAlignmentStatus: "VALID" | "INVALID";
  readonly repositoryHydrationStatus: "READY" | "UNAVAILABLE";
  readonly persistenceReady: boolean;
}

async function resolvePersistenceReadiness(stats: { repositoryType?: "IN_MEMORY" | "SUPABASE"; durability?: "PROCESS_LIFETIME" | "DURABLE"; lastPersistenceError: string | null }): Promise<PersistenceReadinessSummary> {
  const repository = defaultDecisionHistoryRepository as {
    getPersistenceReadiness?: () => Promise<PersistenceReadinessSummary>;
  };
  if (typeof repository.getPersistenceReadiness === "function") return repository.getPersistenceReadiness();
  return {
    persistenceProvider: stats.repositoryType ?? "IN_MEMORY",
    persistenceDurability: stats.durability ?? "PROCESS_LIFETIME",
    migrationExpected: "20260801000100_phase65_decision_history_persistence.sql",
    generatedTypesReady: false,
    schemaAlignmentStatus: "INVALID",
    repositoryHydrationStatus: "UNAVAILABLE",
    persistenceReady: false,
    lastPersistenceError: stats.lastPersistenceError,
  };
}

export const getDecisionHistoryDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<DecisionHistoryDiagnosticsSummary> => {
    const stats = defaultDecisionHistoryRepository.getDecisionHistoryStats();
    const outcomeStats = defaultDecisionHistoryRepository.getOutcomeStats();
    const scheduler = getOutcomeSchedulerDiagnostics();
    const snapshotStats = defaultDecisionHistoryRepository.getMarketSnapshotStats();
    const executionStats = defaultLifecycleExecutionRepository.getExecutionStats();
    const lifecycle = getLifecycleRuntimeState();
    const persistenceReadiness = await resolvePersistenceReadiness(stats);
    const registration = getLifecycleSchedulerRegistrationStatus({ persistenceReady: persistenceReadiness.persistenceReady, lifecycleRunnerCallable: true });
    return {
      repositoryType: stats.repositoryType ?? "IN_MEMORY",
      durability: stats.durability ?? "PROCESS_LIFETIME",
      totalRuns: stats.totalRuns,
      oldestTimestamp: stats.oldestTimestamp,
      newestTimestamp: stats.newestTimestamp,
      instruments: stats.instruments,
      retentionLimit: stats.retentionLimit,
      droppedRunCount: stats.droppedRunCount,
      storedOutcomes: outcomeStats.storedOutcomes,
      evaluatedOutcomes: outcomeStats.evaluatedOutcomes,
      pendingOutcomes: outcomeStats.pendingOutcomes,
      pendingRuns: outcomeStats.pendingRuns,
      cancelledOutcomes: outcomeStats.cancelledOutcomes,
      winRatePct: outcomeStats.winRatePct,
      lossRatePct: outcomeStats.lossRatePct,
      neutralRatePct: outcomeStats.neutralRatePct,
      averageConfidence: outcomeStats.averageConfidence,
      averageEvaluationTimeMs: outcomeStats.averageEvaluationTimeMs,
      pendingQueue: scheduler.pendingQueue,
      evaluatedQueue: scheduler.evaluatedQueue,
      skippedQueue: scheduler.skippedQueue,
      schedulerStatus: scheduler.schedulerStatus,
      lastEvaluationTime: scheduler.lastEvaluationTime,
      averageSchedulerEvaluationDurationMs: scheduler.averageEvaluationDurationMs,
      repositoryHealth: scheduler.repositoryHealth,
      storedMarketSnapshots: snapshotStats.storedMarketSnapshots,
      verifiedMarketSnapshots: snapshotStats.verifiedMarketSnapshots,
      rejectedSnapshotCount: snapshotStats.rejectedSnapshotCount,
      oldestVerifiedSnapshot: snapshotStats.oldestVerifiedSnapshot,
      newestVerifiedSnapshot: snapshotStats.newestVerifiedSnapshot,
      instrumentsCovered: snapshotStats.instrumentsCovered,
      snapshotRepositoryCapacity: snapshotStats.snapshotRepositoryCapacity,
      snapshotRepositoryType: snapshotStats.repositoryType,
      snapshotDurability: snapshotStats.durability,
      schedulerSnapshotSource: snapshotStats.schedulerSnapshotSource,
      schedulerSnapshotReady: snapshotStats.schedulerSnapshotReady,
      lastSnapshotIngestedAt: snapshotStats.lastSnapshotIngestedAt,
      lastSnapshotRejectionReason: redactValue(snapshotStats.lastSnapshotRejectionReason),
      lifecycleRunnerStatus: lifecycle.inFlight ? "BUSY" : "READY",
      lifecycleReady: typeof defaultDecisionHistoryRepository.recordMarketSnapshot === "function" && typeof defaultDecisionHistoryRepository.findVerifiedSnapshot === "function",
      schedulerRegistrationStatus: registration.status,
      schedulerRuntime: registration.runtime,
      schedulerBindingDetected: registration.bindingDetected,
      schedulerEnabled: registration.enabled,
      automaticEvaluationActive: registration.automaticEvaluationActive,
      nextExpectedExecution: registration.nextExpectedExecution,
      activationBlockers: registration.activationBlockers
        .map(redactValue)
        .filter((entry): entry is string => entry !== null),
      lastExecutionAt: executionStats.lastExecutionAt,
      lastExecutionDurationMs: executionStats.lastExecutionDurationMs,
      lastExecutionResult: executionStats.lastExecutionResult,
      totalExecutions: executionStats.totalExecutions,
      successfulExecutions: executionStats.successfulExecutions,
      partialExecutions: executionStats.partialExecutions,
      failedExecutions: executionStats.failedExecutions,
      lastSnapshotAttemptCount: executionStats.lastSnapshotAttemptCount,
      lastSnapshotStoredCount: executionStats.lastSnapshotStoredCount,
      lastEligibleRunCount: executionStats.lastEligibleRunCount,
      lastEvaluatedRunCount: executionStats.lastEvaluatedRunCount,
      lastPendingRunCount: executionStats.lastPendingRunCount,
      inFlight: lifecycle.inFlight,
      retryCount: lifecycle.retryCount,
      lastSafeWarning: redactValue(executionStats.lastSafeWarning),
      executionRepositoryType: executionStats.repositoryType,
      executionDurability: executionStats.durability,
      historicalAccuracyReady: outcomeStats.historicalAccuracyReady,
      replayReady: false,
      learningReady: outcomeStats.learningReady,
      lastPersistenceError: redactValue(persistenceReadiness.lastPersistenceError ?? stats.lastPersistenceError),
      persistenceProvider: persistenceReadiness.persistenceProvider,
      persistenceDurability: persistenceReadiness.persistenceDurability,
      migrationExpected: persistenceReadiness.migrationExpected,
      generatedTypesReady: persistenceReadiness.generatedTypesReady,
      schemaAlignmentStatus: persistenceReadiness.schemaAlignmentStatus,
      repositoryHydrationStatus: persistenceReadiness.repositoryHydrationStatus,
      persistenceReady: persistenceReadiness.persistenceReady,
    };
  });


