// Phase 52 — Portfolio & Risk Management types. Demo-mode only.
// Pure, deterministic. Does not touch trading engines.

export type Direction = "CALL" | "PUT" | "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "CLOSED";

export interface Position {
  readonly id: string;
  readonly instrument: string;
  readonly direction: Direction;
  readonly entryPrice: number;
  readonly currentPrice: number;
  readonly quantity: number;
  readonly stopLoss: number | null;
  readonly target: number | null;
  readonly status: PositionStatus;
  readonly openedAt: string;
  readonly closedAt?: string | null;
  readonly exitPrice?: number | null;
  readonly notes?: string;
}

export interface PnlLedgerRow {
  readonly ts: string;
  readonly pnl: number;
}

export interface PortfolioState {
  readonly totalCapital: number;
  readonly positions: readonly Position[];
  readonly ledger: readonly PnlLedgerRow[];
}

export interface PortfolioSummary {
  readonly totalCapital: number;
  readonly investedCapital: number;
  readonly availableCapital: number;
  readonly unrealizedPnl: number;
  readonly realizedPnl: number;
  readonly dailyPnl: number;
  readonly weeklyPnl: number;
  readonly monthlyPnl: number;
  readonly totalReturnPct: number;
  readonly openPositions: number;
  readonly closedPositions: number;
}

export interface WatchlistItem {
  readonly symbol: string;
  readonly pinned: boolean;
  readonly addedAt: string;
  readonly note?: string;
}

export interface Watchlist {
  readonly id: string;
  readonly name: string;
  readonly items: readonly WatchlistItem[];
}

export type AlertKind =
  | "AI_DECISION_CHANGED"
  | "INSTITUTIONAL_SCORE_CHANGED"
  | "PCR_THRESHOLD"
  | "VIX_THRESHOLD"
  | "STOP_LOSS_HIT"
  | "TARGET_HIT";

export interface LocalAlert {
  readonly id: string;
  readonly kind: AlertKind;
  readonly symbol?: string;
  readonly threshold?: number;
  readonly direction?: "ABOVE" | "BELOW";
  readonly createdAt: string;
  readonly triggeredAt?: string | null;
  readonly message: string;
  readonly active: boolean;
}