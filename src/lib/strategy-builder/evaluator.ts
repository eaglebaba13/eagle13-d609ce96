// Phase 51 — Pure rule evaluator. Deterministic, no I/O.
import type { Condition, IndicatorSnapshot, RuleGroup } from "./types";

export function evaluateCondition(c: Condition, snap: IndicatorSnapshot): boolean | null {
  const v = snap[c.indicator];
  if (v == null || !Number.isFinite(v)) return null; // missing → skipped
  switch (c.op) {
    case ">": return v > c.value;
    case "<": return v < c.value;
    case ">=": return v >= c.value;
    case "<=": return v <= c.value;
    case "=": return v === c.value;
  }
}

export function evaluateGroup(g: RuleGroup, snap: IndicatorSnapshot): boolean {
  const parts: boolean[] = [];
  for (const c of g.conditions) {
    const r = evaluateCondition(c, snap);
    if (r !== null) parts.push(r);
  }
  for (const sub of g.groups ?? []) parts.push(evaluateGroup(sub, snap));
  if (parts.length === 0) return false;
  const combined = g.combinator === "AND" ? parts.every(Boolean) : parts.some(Boolean);
  return g.negate ? !combined : combined;
}