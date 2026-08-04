export interface DecisionRunIdInput {
  readonly timestamp: string;
  readonly instrument: string;
  readonly decision: string;
  readonly confidence: number | null;
}

export function createDecisionRunId(input: DecisionRunIdInput): string {
  const stamp = input.timestamp.replace(/[:.TZ-]/g, "").slice(0, 14);
  const instrument = input.instrument.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const decision = input.decision.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const confidence = Number.isFinite(input.confidence) ? Math.round(Number(input.confidence)) : 0;
  return `decision-${instrument || "GENERIC"}-${stamp}-${decision || "UNKNOWN"}-${confidence}`;
}
