// Phase 51 — Visual Strategy Builder & Backtesting Lab (types).
// Independent module: does not modify AI/Institutional/Astro/Gann/PCR/Option
// Chain/Decision/Telegram/Auth/Subscription or the DB schema.

export type IndicatorId =
  | "GTI"
  | "ASTRO_BIAS"
  | "GANN_BIAS"
  | "VIX"
  | "PCR"
  | "INSTITUTIONAL_SCORE"
  | "MARKET_BREADTH"
  | "SECTOR_ROTATION"
  | "AI_DECISION"
  | "OPTION_CHAIN_PCR"
  | "GOLD_SILVER_RATIO";

export type Comparator = ">" | "<" | ">=" | "<=" | "=";

export type Condition = {
  readonly id: string;
  readonly indicator: IndicatorId;
  readonly op: Comparator;
  readonly value: number; // numeric threshold (bias fields normalised -1..+1)
};

export type RuleGroup = {
  readonly id: string;
  readonly combinator: "AND" | "OR";
  readonly negate?: boolean;
  readonly conditions: readonly Condition[];
  readonly groups?: readonly RuleGroup[];
};

export type ActionKind = "BUY_CALL" | "BUY_PUT" | "WAIT" | "EXIT";

export type StrategyAction = {
  readonly kind: ActionKind;
  readonly comment?: string;
};

export type RiskRules = {
  readonly maxDailyLossPct?: number;
  readonly maxTrades?: number;
  readonly riskPct?: number;
  readonly targetPct?: number;
  readonly stopPct?: number;
  readonly trailingStopPct?: number;
};

export type Strategy = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly entry: RuleGroup;
  readonly exit?: RuleGroup;
  readonly action: StrategyAction;
  readonly risk?: RiskRules;
  readonly builtin?: boolean;
};

// Snapshot of indicator values at a single bar. All fields optional; missing
// values disable conditions that reference them (never fabricated).
export type IndicatorSnapshot = Partial<Record<IndicatorId, number>>;

export type Bar = {
  readonly t: number; // epoch ms
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly indicators: IndicatorSnapshot;
};

export type BacktestTrade = {
  readonly entryTime: number;
  readonly exitTime: number;
  readonly side: "CALL" | "PUT";
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly pnl: number; // absolute P&L per unit
  readonly pnlPct: number;
  readonly holdBars: number;
  readonly exitReason: "TARGET" | "STOP" | "TRAIL" | "SIGNAL" | "EOD";
};

export type MonthlyReturn = { readonly month: string; readonly pnl: number };

export type BacktestResult = {
  readonly strategyId: string;
  readonly strategyName: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly totalTrades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly lossRate: number;
  readonly profitFactor: number;
  readonly expectancy: number;
  readonly totalPnl: number;
  readonly maxDrawdown: number;
  readonly maxDrawdownPct: number;
  readonly avgHoldBars: number;
  readonly monthlyReturns: readonly MonthlyReturn[];
  readonly equityCurve: readonly { readonly t: number; readonly equity: number }[];
  readonly drawdownCurve: readonly { readonly t: number; readonly dd: number }[];
  readonly trades: readonly BacktestTrade[];
  readonly assumptions: readonly string[];
};

export type StrategyReport = {
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly risk: readonly string[];
  readonly improvements: readonly string[];
};

export const INDICATOR_META: Record<IndicatorId, { label: string; unit: string; hint: string }> = {
  GTI: { label: "GTI Indicator", unit: "score", hint: "Composite trend score" },
  ASTRO_BIAS: { label: "Astro Bias", unit: "-1..+1", hint: "Bearish → Bullish" },
  GANN_BIAS: { label: "Gann Bias", unit: "-1..+1", hint: "Reversal proximity" },
  VIX: { label: "India VIX", unit: "%", hint: "Volatility index" },
  PCR: { label: "PCR", unit: "ratio", hint: "Put-Call Ratio" },
  INSTITUTIONAL_SCORE: { label: "Institutional Score", unit: "0-100", hint: "Institutional bias" },
  MARKET_BREADTH: { label: "Market Breadth", unit: "%", hint: "Advance/decline" },
  SECTOR_ROTATION: { label: "Sector Rotation", unit: "-1..+1", hint: "Rotation strength" },
  AI_DECISION: { label: "AI Decision", unit: "-1..+1", hint: "-1 PUT, 0 WAIT, +1 CALL" },
  OPTION_CHAIN_PCR: { label: "Option Chain PCR", unit: "ratio", hint: "OI-based PCR" },
  GOLD_SILVER_RATIO: { label: "Gold/Silver Ratio", unit: "ratio", hint: "Macro risk gauge" },
};