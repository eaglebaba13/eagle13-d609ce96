export type BreadthMarketSessionState = "REGULAR" | "CLOSED" | "UNKNOWN";

export interface BreadthMarketSessionPolicy {
  readonly state: BreadthMarketSessionState;
  readonly reason: string;
  readonly retryable: boolean;
}

export function getNseMarketSessionState(now: Date = new Date()): BreadthMarketSessionPolicy {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = value("weekday");
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { state: "UNKNOWN", reason: "market session unknown", retryable: true };
  }
  if (weekday === "Sat" || weekday === "Sun") {
    return { state: "CLOSED", reason: "weekend market closure", retryable: false };
  }

  const minutes = hour * 60 + minute;
  const open = 9 * 60 + 15;
  const close = 15 * 60 + 30;
  if (minutes < open || minutes > close) {
    return { state: "CLOSED", reason: "outside NSE regular session", retryable: false };
  }
  return { state: "REGULAR", reason: "NSE regular session", retryable: true };
}
