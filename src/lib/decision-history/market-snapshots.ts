import type { FutureMarketSnapshot } from "./outcome-evaluator";
import type {
  DecisionMarketSnapshotRecord,
  DecisionPersistenceRepository,
  FindVerifiedMarketSnapshotInput,
} from "./types";

export const MARKET_SNAPSHOT_METADATA_VERSION = "DECISION_MARKET_SNAPSHOT_V1";
export const DEFAULT_SCHEDULER_SNAPSHOT_DISTANCE_MS = 5 * 60 * 1000;

export function marketSnapshotToFutureSnapshot(snapshot: DecisionMarketSnapshotRecord): FutureMarketSnapshot {
  return {
    instrument: snapshot.instrument,
    timestamp: snapshot.observedAt,
    price: snapshot.price,
    providerLabels: { marketSnapshot: snapshot.providerAlias, snapshotId: snapshot.snapshotId },
  };
}

export function findSchedulerVerifiedSnapshot(
  repository: Pick<DecisionPersistenceRepository, "findVerifiedSnapshot">,
  input: Omit<FindVerifiedMarketSnapshotInput, "maximumAllowedDistanceMs"> & { readonly maximumAllowedDistanceMs?: number },
): FutureMarketSnapshot | null {
  const snapshot = repository.findVerifiedSnapshot?.({
    instrument: input.instrument,
    evaluationTimestamp: input.evaluationTimestamp,
    maximumAllowedDistanceMs: input.maximumAllowedDistanceMs ?? DEFAULT_SCHEDULER_SNAPSHOT_DISTANCE_MS,
    providerAlias: input.providerAlias,
  }) ?? null;
  return snapshot ? marketSnapshotToFutureSnapshot(snapshot) : null;
}
