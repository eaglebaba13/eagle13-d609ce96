import { createDecisionRunId } from "./run-id";
import { serializeDecisionRecord } from "./serializer";
import type { DecisionPersistenceRepository, DecisionPersistedRecord, PersistCompletedDecisionResult } from "./types";
import { defaultDecisionHistoryRepository } from "./repository";

export interface PersistCompletedDecisionInput {
  readonly timestamp: string;
  readonly instrument: string;
  readonly spot: number | null;
  readonly decision: string;
  readonly confidence: number | null;
  readonly risk: {
    readonly level: string;
    readonly reasons: readonly string[];
  };
  readonly signals: readonly unknown[];
  readonly capabilities: Record<string, unknown>;
  readonly summary: Record<string, unknown>;
  readonly formulaVersions: Record<string, string>;
  readonly providerLabels: Record<string, string>;
}

function normalizeRisk(risk: PersistCompletedDecisionInput["risk"]): { level: string; reasons: readonly string[] } {
  return {
    level: String(risk?.level ?? "UNKNOWN"),
    reasons: Array.isArray(risk?.reasons) ? risk.reasons.map((v) => String(v)) : [],
  };
}

export async function persistCompletedDecision(
  input: PersistCompletedDecisionInput,
  repository: DecisionPersistenceRepository,
): Promise<PersistCompletedDecisionResult> {
  const runId = createDecisionRunId({
    timestamp: input.timestamp,
    instrument: input.instrument,
    decision: input.decision,
    confidence: input.confidence,
  });

  const record: DecisionPersistedRecord = {
    runId,
    timestamp: input.timestamp,
    instrument: input.instrument,
    spot: input.spot ?? null,
    decision: input.decision,
    confidence: input.confidence ?? null,
    risk: normalizeRisk(input.risk),
    signals: Array.isArray(input.signals) ? input.signals : [],
    capabilities: input.capabilities ?? {},
    summary: input.summary ?? {},
    formulaVersions: input.formulaVersions ?? {},
    providerLabels: input.providerLabels ?? {},
  };

  try {
    await repository.save(record);
    return { ok: true, runId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const repo = repository as { save?: (record: DecisionPersistedRecord) => Promise<void> };
    if (repo && typeof repo.save === "function") {
      console.warn(`[decision-history] persistence failed for ${runId}: ${reason}`);
    }
    return { ok: false, runId, reason };
  }
}

export async function persistCompletedDecisionWithDefaultRepository(
  input: PersistCompletedDecisionInput,
): Promise<PersistCompletedDecisionResult> {
  return persistCompletedDecision(input, defaultDecisionHistoryRepository);
}

export function buildDecisionRecordPayload(input: PersistCompletedDecisionInput): DecisionPersistedRecord {
  const runId = createDecisionRunId({
    timestamp: input.timestamp,
    instrument: input.instrument,
    decision: input.decision,
    confidence: input.confidence,
  });
  return {
    runId,
    timestamp: input.timestamp,
    instrument: input.instrument,
    spot: input.spot ?? null,
    decision: input.decision,
    confidence: input.confidence ?? null,
    risk: normalizeRisk(input.risk),
    signals: Array.isArray(input.signals) ? input.signals : [],
    capabilities: input.capabilities ?? {},
    summary: input.summary ?? {},
    formulaVersions: input.formulaVersions ?? {},
    providerLabels: input.providerLabels ?? {},
  };
}

export function serializePersistedDecision(input: PersistCompletedDecisionInput): string {
  return serializeDecisionRecord(buildDecisionRecordPayload(input));
}
