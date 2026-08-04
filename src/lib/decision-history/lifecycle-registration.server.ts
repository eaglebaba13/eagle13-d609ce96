import { runScheduledEvaluationLifecycle, type ScheduledEvaluationRunnerOptions } from "./lifecycle-runner.server";

export type LifecycleSchedulerRuntime = "CLOUDFLARE_SCHEDULED" | "SUPABASE_CRON" | "EXTERNAL_HTTP_CRON" | "MANUAL_ONLY" | "UNSUPPORTED";
export type LifecycleSchedulerRegistrationStatus =
  | "INACTIVE_UNSUPPORTED_RUNTIME"
  | "INACTIVE_MANUAL_ONLY"
  | "DISABLED_IN_TEST"
  | "DISABLED_LOCAL_DEVELOPMENT"
  | "INVALID_CONFIGURATION"
  | "BLOCKED_PERSISTENCE"
  | "REGISTERED";

export type SchedulerMarketSessionStatus = "OPEN" | "MARKET_CLOSED" | "NO_WORK";

export interface LifecycleSchedulerRegistrationSummary {
  readonly runtime: LifecycleSchedulerRuntime;
  readonly bindingDetected: boolean;
  readonly enabled: boolean;
  readonly status: LifecycleSchedulerRegistrationStatus;
  readonly automaticEvaluationActive: boolean;
  readonly scheduleIdentifier: string;
  readonly intervalMs: number;
  readonly cronExpression: string | null;
  readonly maxDurationMs: number;
  readonly retryLimit: number;
  readonly retryBackoffMs: number;
  readonly supportedInstruments: readonly string[];
  readonly nextExpectedExecution: string | null;
  readonly activationBlockers: readonly string[];
  readonly reason: string;
}

export interface LifecycleSchedulerRegistrationOptions {
  readonly runtime?: LifecycleSchedulerRuntime;
  readonly bindingDetected?: boolean;
  readonly enabled?: boolean;
  readonly scheduleIdentifier?: string;
  readonly intervalMs?: number;
  readonly cronExpression?: string | null;
  readonly maxDurationMs?: number;
  readonly retryLimit?: number;
  readonly retryBackoffMs?: number;
  readonly supportedInstruments?: readonly string[];
  readonly persistenceReady?: boolean;
  readonly lifecycleRunnerCallable?: boolean;
  readonly force?: boolean;
  readonly nowIso?: string;
}

export interface ScheduledLifecycleAdapterOptions extends ScheduledEvaluationRunnerOptions {
  readonly registration?: LifecycleSchedulerRegistrationOptions;
}

const DEFAULT_INTERVAL_MS = 5 * 60_000;
const DEFAULT_MAX_DURATION_MS = 45_000;
const DEFAULT_RETRY_LIMIT = 2;
const DEFAULT_RETRY_BACKOFF_MS = 1_000;
const DEFAULT_SUPPORTED_INSTRUMENTS = Object.freeze(["NIFTY50", "BANKNIFTY", "INDIA_VIX"] as const);
let registeredSummary: LifecycleSchedulerRegistrationSummary | null = null;

function isTestRuntime(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "test";
}

function isLocalDevelopmentRuntime(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "development";
}

function sanitizeText(value: string): string {
  return value.replace(/token|secret|authorization|cookie|api[-_]?key|bearer/gi, "[REDACTED]").slice(0, 160);
}

function normalizePositiveInt(value: number | undefined, fallback: number, minimum: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(minimum, Math.trunc(value as number));
}

function buildSummary(input: {
  readonly runtime: LifecycleSchedulerRuntime;
  readonly bindingDetected: boolean;
  readonly enabled: boolean;
  readonly status: LifecycleSchedulerRegistrationStatus;
  readonly automaticEvaluationActive: boolean;
  readonly reason: string;
  readonly options: LifecycleSchedulerRegistrationOptions;
  readonly activationBlockers: readonly string[];
}): LifecycleSchedulerRegistrationSummary {
  const intervalMs = normalizePositiveInt(input.options.intervalMs, DEFAULT_INTERVAL_MS, 60_000);
  const nowIso = input.options.nowIso ?? new Date().toISOString();
  const nextExpectedExecution = input.automaticEvaluationActive ? new Date(Date.parse(nowIso) + intervalMs).toISOString() : null;
  return Object.freeze({
    runtime: input.runtime,
    bindingDetected: input.bindingDetected,
    enabled: input.enabled,
    status: input.status,
    automaticEvaluationActive: input.automaticEvaluationActive,
    scheduleIdentifier: sanitizeText(input.options.scheduleIdentifier ?? "decision-history-lifecycle"),
    intervalMs,
    cronExpression: input.options.cronExpression ? sanitizeText(input.options.cronExpression) : null,
    maxDurationMs: normalizePositiveInt(input.options.maxDurationMs, DEFAULT_MAX_DURATION_MS, 1_000),
    retryLimit: normalizePositiveInt(input.options.retryLimit, DEFAULT_RETRY_LIMIT, 0),
    retryBackoffMs: normalizePositiveInt(input.options.retryBackoffMs, DEFAULT_RETRY_BACKOFF_MS, 250),
    supportedInstruments: Object.freeze([...(input.options.supportedInstruments ?? DEFAULT_SUPPORTED_INSTRUMENTS)].map(sanitizeText)),
    nextExpectedExecution,
    activationBlockers: Object.freeze(input.activationBlockers.map(sanitizeText)),
    reason: sanitizeText(input.reason),
  });
}

export function classifyLifecycleSchedulerRuntime(options: Pick<LifecycleSchedulerRegistrationOptions, "runtime" | "bindingDetected"> = {}): LifecycleSchedulerRuntime {
  if (options.runtime) return options.runtime;
  if (options.bindingDetected) return "EXTERNAL_HTTP_CRON";
  return "MANUAL_ONLY";
}

export function evaluateSchedulerMarketSession(nowIso = new Date().toISOString()): { readonly status: SchedulerMarketSessionStatus; readonly reason: string } {
  const parsed = Date.parse(nowIso);
  if (!Number.isFinite(parsed)) return { status: "NO_WORK", reason: "INVALID_SCHEDULE_TIME" };
  const ist = new Date(parsed + 330 * 60_000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return { status: "MARKET_CLOSED", reason: "WEEKEND" };
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (minutes < 9 * 60 + 15 || minutes > 15 * 60 + 30) return { status: "MARKET_CLOSED", reason: "OUTSIDE_NSE_SESSION_WINDOW" };
  return { status: "OPEN", reason: "WEEKDAY_SESSION_WINDOW" };
}

export function shouldRetryLifecycleFailure(reason: string): boolean {
  return /PROVIDER_UNAVAILABLE|REPOSITORY_UNAVAILABLE|NETWORK|TEMPORARY/i.test(reason)
    && !/MARKET_CLOSED|NO_WORK|SNAPSHOT_REJECTED|UNSUPPORTED|INVALID_CONFIGURATION|EXISTING_OUTCOME/i.test(reason);
}

export function computeLifecycleRetryBackoffMs(attempt: number, baseMs = DEFAULT_RETRY_BACKOFF_MS): number {
  const safeAttempt = Math.max(0, Math.min(8, Math.trunc(attempt)));
  const safeBase = normalizePositiveInt(baseMs, DEFAULT_RETRY_BACKOFF_MS, 250);
  return Math.min(60_000, safeBase * 2 ** safeAttempt);
}

export function registerDecisionOutcomeLifecycleScheduler(options: LifecycleSchedulerRegistrationOptions = {}): LifecycleSchedulerRegistrationSummary {
  const runtime = classifyLifecycleSchedulerRuntime(options);
  const bindingDetected = options.bindingDetected === true;
  const enabled = options.enabled === true;
  const lifecycleRunnerCallable = options.lifecycleRunnerCallable !== false;
  const persistenceReady = options.persistenceReady === true;
  const blockers: string[] = [];

  if (isTestRuntime() && !options.force) {
    return buildSummary({ runtime, bindingDetected, enabled: false, status: "DISABLED_IN_TEST", automaticEvaluationActive: false, reason: "Disabled in test runtime.", options, activationBlockers: ["TEST_RUNTIME"] });
  }
  if (isLocalDevelopmentRuntime() && !options.force) {
    return buildSummary({ runtime, bindingDetected, enabled: false, status: "DISABLED_LOCAL_DEVELOPMENT", automaticEvaluationActive: false, reason: "Disabled in local development runtime.", options, activationBlockers: ["LOCAL_DEVELOPMENT"] });
  }
  if (registeredSummary) return registeredSummary;

  if (runtime === "UNSUPPORTED") blockers.push("UNSUPPORTED_RUNTIME");
  if (runtime === "MANUAL_ONLY") blockers.push("MANUAL_ONLY_RUNTIME");
  if (!bindingDetected) blockers.push("SCHEDULER_BINDING_NOT_DETECTED");
  if (!enabled) blockers.push("SCHEDULER_DISABLED");
  if (!persistenceReady) blockers.push("PERSISTENCE_NOT_READY");
  if (!lifecycleRunnerCallable) blockers.push("LIFECYCLE_RUNNER_UNAVAILABLE");

  if ((options.intervalMs != null && options.intervalMs < 60_000) || (options.maxDurationMs != null && options.maxDurationMs < 1_000) || (options.retryLimit != null && options.retryLimit < 0)) {
    blockers.push("INVALID_CONFIGURATION");
    return buildSummary({ runtime, bindingDetected, enabled, status: "INVALID_CONFIGURATION", automaticEvaluationActive: false, reason: "Invalid scheduler configuration; failing closed.", options, activationBlockers: blockers });
  }

  if (blockers.includes("PERSISTENCE_NOT_READY")) {
    return buildSummary({ runtime, bindingDetected, enabled, status: "BLOCKED_PERSISTENCE", automaticEvaluationActive: false, reason: "Durable persistence is not ready.", options, activationBlockers: blockers });
  }
  if (blockers.length > 0) {
    const status: LifecycleSchedulerRegistrationStatus = runtime === "MANUAL_ONLY" ? "INACTIVE_MANUAL_ONLY" : "INACTIVE_UNSUPPORTED_RUNTIME";
    return buildSummary({ runtime, bindingDetected, enabled, status, automaticEvaluationActive: false, reason: "Production scheduler registration pending supported runtime binding.", options, activationBlockers: blockers });
  }

  registeredSummary = buildSummary({ runtime, bindingDetected, enabled, status: "REGISTERED", automaticEvaluationActive: true, reason: "Verified scheduler binding registered.", options, activationBlockers: [] });
  return registeredSummary;
}

export async function runRegisteredDecisionOutcomeLifecycle(options: ScheduledLifecycleAdapterOptions = {}): Promise<Awaited<ReturnType<typeof runScheduledEvaluationLifecycle>>> {
  const registration = registerDecisionOutcomeLifecycleScheduler(options.registration);
  if (!registration.automaticEvaluationActive) {
    const now = options.nowIso ?? new Date().toISOString();
    return {
      executionId: options.executionId ?? `scheduled-decision-lifecycle::${now}`,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      snapshotsAttempted: 0,
      snapshotsStored: 0,
      eligibleRuns: 0,
      evaluatedRuns: 0,
      skippedRuns: 0,
      pendingRuns: 0,
      failedRuns: 0,
      status: "NO_WORK",
      safeWarnings: [...registration.activationBlockers],
    };
  }
  const marketSession = evaluateSchedulerMarketSession(options.nowIso);
  if (marketSession.status !== "OPEN") {
    const now = options.nowIso ?? new Date().toISOString();
    return {
      executionId: options.executionId ?? `scheduled-decision-lifecycle::${now}`,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      snapshotsAttempted: 0,
      snapshotsStored: 0,
      eligibleRuns: 0,
      evaluatedRuns: 0,
      skippedRuns: 0,
      pendingRuns: 0,
      failedRuns: 0,
      status: "NO_WORK",
      safeWarnings: [marketSession.reason],
    };
  }
  return runScheduledEvaluationLifecycle(options);
}

export async function runManualDecisionOutcomeLifecycle(options: ScheduledEvaluationRunnerOptions = {}): Promise<Awaited<ReturnType<typeof runScheduledEvaluationLifecycle>>> {
  const now = options.nowIso ?? new Date().toISOString();
  return runScheduledEvaluationLifecycle({ ...options, executionId: options.executionId ?? `manual-decision-lifecycle::${now}` });
}

export function getLifecycleSchedulerRegistrationStatus(options: Pick<LifecycleSchedulerRegistrationOptions, "persistenceReady" | "lifecycleRunnerCallable"> = {}): LifecycleSchedulerRegistrationSummary {
  if (!registeredSummary) return registerDecisionOutcomeLifecycleScheduler({ persistenceReady: options.persistenceReady, lifecycleRunnerCallable: options.lifecycleRunnerCallable });
  if (options.persistenceReady === false) {
    return buildSummary({ runtime: registeredSummary.runtime, bindingDetected: registeredSummary.bindingDetected, enabled: registeredSummary.enabled, status: "BLOCKED_PERSISTENCE", automaticEvaluationActive: false, reason: "Durable persistence is not ready.", options: { ...registeredSummary, persistenceReady: false }, activationBlockers: ["PERSISTENCE_NOT_READY"] });
  }
  return registeredSummary;
}

export function resetLifecycleSchedulerRegistrationForTests(): void {
  registeredSummary = null;
}
