import { SMART_ALERTS_RULES_VERSION, type AlertEvent, type AlertPriority, type AlertType } from "./types";

export interface AlertListFilters {
  readonly limit?: number;
  readonly unreadOnly?: boolean;
  readonly dismissedOnly?: boolean;
  readonly priority?: AlertPriority | "ALL";
  readonly type?: AlertType | "ALL";
  readonly instrument?: string | "ALL";
  readonly search?: string;
}

export interface AlertRepositoryRecord {
  readonly id: string;
  readonly fingerprint: string;
  readonly type: AlertType;
  readonly priority: AlertPriority;
  readonly title: string;
  readonly summary: string;
  readonly instrument: string | null;
  readonly tradingDate: string;
  readonly generatedAt: string;
  readonly readAt: string | null;
  readonly dismissedAt: string | null;
  readonly rulesVersion: string;
  readonly sourceModules: readonly string[];
  readonly payload: AlertEvent | null;
}

export interface AlertRepositoryStats {
  readonly repositoryProvider: "IN_MEMORY" | "SUPABASE";
  readonly durability: "PROCESS_LIFETIME" | "DURABLE";
  readonly persistenceReady: boolean;
  readonly totalAlerts: number;
  readonly unreadAlerts: number;
  readonly dismissedAlerts: number;
  readonly lastAlertCreatedAt: string | null;
  readonly lastSafeError: string | null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === "object") deepFreeze(child);
    }
  }
  return value;
}

function clone(record: AlertRepositoryRecord): AlertRepositoryRecord {
  return deepFreeze({
    ...record,
    sourceModules: [...record.sourceModules],
    payload: record.payload ? JSON.parse(JSON.stringify(record.payload)) as AlertEvent : null,
  });
}

function matchesSearch(record: AlertRepositoryRecord, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [record.title, record.summary, record.type, record.instrument ?? ""].join(" ").toLowerCase().includes(q);
}

export class InMemoryAlertRepository {
  private readonly records = new Map<string, AlertRepositoryRecord>();
  private lastSafeError: string | null = null;

  constructor(private readonly retentionLimit = 500) {}

  recordAlert(alert: AlertRepositoryRecord): AlertRepositoryRecord {
    const normalized = clone({ ...alert, rulesVersion: alert.rulesVersion || SMART_ALERTS_RULES_VERSION });
    const existing = this.records.get(normalized.id);
    if (existing) return clone(existing);
    for (const item of this.records.values()) {
      if (item.fingerprint === normalized.fingerprint) return clone(item);
    }
    this.records.set(normalized.id, normalized);
    while (this.records.size > this.retentionLimit) {
      const oldest = this.records.keys().next().value as string | undefined;
      if (!oldest) break;
      this.records.delete(oldest);
    }
    return clone(normalized);
  }

  getAlert(alertId: string): AlertRepositoryRecord | null {
    const item = this.records.get(alertId);
    return item ? clone(item) : null;
  }

  listAlerts(filters: AlertListFilters = {}): readonly AlertRepositoryRecord[] {
    const limit = Math.max(0, Math.min(Math.trunc(filters.limit ?? this.records.size), this.records.size));
    return Array.from(this.records.values())
      .filter((row) => !filters.unreadOnly || (!row.readAt && !row.dismissedAt))
      .filter((row) => !filters.dismissedOnly || !!row.dismissedAt)
      .filter((row) => !filters.priority || filters.priority === "ALL" || row.priority === filters.priority)
      .filter((row) => !filters.type || filters.type === "ALL" || row.type === filters.type)
      .filter((row) => !filters.instrument || filters.instrument === "ALL" || (row.instrument ?? "") === filters.instrument)
      .filter((row) => matchesSearch(row, filters.search ?? ""))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(clone);
  }

  markAlertRead(alertId: string, nowIso = new Date().toISOString()): boolean {
    const item = this.records.get(alertId);
    if (!item) return false;
    this.records.set(alertId, clone({ ...item, readAt: item.readAt ?? nowIso }));
    return true;
  }

  dismissAlert(alertId: string, nowIso = new Date().toISOString()): boolean {
    const item = this.records.get(alertId);
    if (!item) return false;
    this.records.set(alertId, clone({ ...item, readAt: item.readAt ?? nowIso, dismissedAt: item.dismissedAt ?? nowIso }));
    return true;
  }

  markAllRead(nowIso = new Date().toISOString()): number {
    let updated = 0;
    for (const item of this.records.values()) {
      if (!item.readAt) {
        this.records.set(item.id, clone({ ...item, readAt: nowIso }));
        updated += 1;
      }
    }
    return updated;
  }

  getAlertStats(): AlertRepositoryStats {
    const rows = Array.from(this.records.values());
    return deepFreeze({
      repositoryProvider: "IN_MEMORY",
      durability: "PROCESS_LIFETIME",
      persistenceReady: true,
      totalAlerts: rows.length,
      unreadAlerts: rows.filter((row) => !row.readAt && !row.dismissedAt).length,
      dismissedAlerts: rows.filter((row) => !!row.dismissedAt).length,
      lastAlertCreatedAt: rows.map((row) => row.generatedAt).sort().at(-1) ?? null,
      lastSafeError: this.lastSafeError,
    });
  }

  resetAlertsForTests(): void {
    this.records.clear();
    this.lastSafeError = null;
  }
}
