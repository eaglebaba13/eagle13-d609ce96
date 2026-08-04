const REDACTED = "[REDACTED]";
const SECRET_KEYS = /token|secret|authorization|cookie|header|api[-_]?key/i;

export function redactValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) return null;
  return REDACTED;
}

function redactValueRecursively(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_KEYS.test(value) ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map(redactValueRecursively);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.test(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactValueRecursively(v);
      }
    }
    return out;
  }
  return value;
}

function sanitizeForStorage<T>(value: T): T {
  return redactValueRecursively(value) as T;
}

export function serializeDecisionRecord(record: unknown): string {
  return JSON.stringify(sanitizeForStorage(record));
}

export function deserializeDecisionRecord(raw: string): unknown {
  return JSON.parse(raw);
}
