export const CONTRACT_REGISTRY_VERSION = "CONTRACT_SPEC_REGISTRY_V2";
export const CONTRACT_REGISTRY_LAST_UPDATED = "2026-08-01";
export const CONTRACT_REGISTRY_SOURCE_TYPE = "EXCHANGE_METADATA_WITH_UNKNOWN_PLACEHOLDERS";

export type ContractUnknown = "UNKNOWN";
export type ContractNumber = number | ContractUnknown;
export type ContractStatus = "ACTIVE" | "UNSUPPORTED" | "UNKNOWN";
export type ContractExchange = "NSE" | "BSE" | "MCX" | "UNKNOWN";
export type ContractVerificationSource = "NSE_PUBLIC_CONTRACT_FILES" | "NSE_PRODUCT_SPECIFICATION" | "PROJECT_METADATA" | "UNKNOWN";

export interface ContractSpecification {
  readonly instrument: string;
  readonly exchange: ContractExchange;
  readonly underlying: string;
  readonly lotSize: ContractNumber;
  readonly tickSize: ContractNumber;
  readonly contractMultiplier: ContractNumber;
  readonly strikeInterval: ContractNumber;
  readonly freezeQuantity: ContractNumber;
  readonly derivativeSupported: boolean | ContractUnknown;
  readonly effectiveFrom: string | ContractUnknown;
  readonly verificationSource: ContractVerificationSource;
  readonly verifiedAt: string | ContractUnknown;
  readonly version: string;
  readonly status: ContractStatus;
}

export interface ContractRegistryValidationIssue {
  readonly code:
    | "DUPLICATE_INSTRUMENT"
    | "INVALID_LOT_SIZE"
    | "INVALID_FREEZE_QUANTITY"
    | "ZERO_MULTIPLIER"
    | "NEGATIVE_TICK_SIZE"
    | "MISSING_EXCHANGE"
    | "MISSING_EFFECTIVE_DATE";
  readonly instrument: string;
  readonly field: keyof ContractSpecification | "instrument";
  readonly message: string;
}

export interface ContractRegistryDiagnostics {
  readonly registryVersion: string;
  readonly registryEntries: number;
  readonly missingFields: readonly string[];
  readonly duplicateInstruments: readonly string[];
  readonly validationStatus: "VALID" | "INVALID";
  readonly lastUpdated: string;
  readonly sourceType: string;
  readonly verifiedInstruments: readonly string[];
  readonly unverifiedInstruments: readonly string[];
  readonly lotSizeCoverage: number;
  readonly freezeQuantityCoverage: number;
  readonly strikeIntervalCoverage: number;
  readonly currentRegistryVersion: string;
  readonly lastVerificationDate: string | ContractUnknown;
  readonly hardcodedReferencesRemaining: readonly string[];
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

const CONTRACT_METADATA: readonly ContractSpecification[] = [
  {
    instrument: "NIFTY",
    exchange: "NSE",
    underlying: "NIFTY 50",
    lotSize: 65,
    tickSize: 0.05,
    contractMultiplier: 1,
    strikeInterval: 50,
    freezeQuantity: 1800,
    derivativeSupported: true,
    effectiveFrom: "2025-12-30",
    verificationSource: "NSE_PUBLIC_CONTRACT_FILES",
    verifiedAt: CONTRACT_REGISTRY_LAST_UPDATED,
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "NIFTY50",
    exchange: "NSE",
    underlying: "NIFTY 50",
    lotSize: "UNKNOWN",
    tickSize: "UNKNOWN",
    contractMultiplier: "UNKNOWN",
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: false,
    effectiveFrom: "UNKNOWN",
    verificationSource: "PROJECT_METADATA",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "BANKNIFTY",
    exchange: "NSE",
    underlying: "NIFTY BANK",
    lotSize: 30,
    tickSize: 0.05,
    contractMultiplier: 1,
    strikeInterval: 100,
    freezeQuantity: 600,
    derivativeSupported: true,
    effectiveFrom: "2025-12-30",
    verificationSource: "NSE_PUBLIC_CONTRACT_FILES",
    verifiedAt: CONTRACT_REGISTRY_LAST_UPDATED,
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "FINNIFTY",
    exchange: "NSE",
    underlying: "NIFTY FINANCIAL SERVICES",
    lotSize: 60,
    tickSize: 0.05,
    contractMultiplier: 1,
    strikeInterval: 50,
    freezeQuantity: 1800,
    derivativeSupported: true,
    effectiveFrom: "2025-12-30",
    verificationSource: "NSE_PUBLIC_CONTRACT_FILES",
    verifiedAt: CONTRACT_REGISTRY_LAST_UPDATED,
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "MIDCPNIFTY",
    exchange: "NSE",
    underlying: "NIFTY MIDCAP SELECT",
    lotSize: 120,
    tickSize: 0.05,
    contractMultiplier: 1,
    strikeInterval: 25,
    freezeQuantity: 2800,
    derivativeSupported: true,
    effectiveFrom: "2025-12-30",
    verificationSource: "NSE_PUBLIC_CONTRACT_FILES",
    verifiedAt: CONTRACT_REGISTRY_LAST_UPDATED,
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "SENSEX",
    exchange: "BSE",
    underlying: "SENSEX",
    lotSize: "UNKNOWN",
    tickSize: "UNKNOWN",
    contractMultiplier: "UNKNOWN",
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: true,
    effectiveFrom: "UNKNOWN",
    verificationSource: "UNKNOWN",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "UNKNOWN",
  },
  {
    instrument: "BANKEX",
    exchange: "BSE",
    underlying: "BANKEX",
    lotSize: "UNKNOWN",
    tickSize: "UNKNOWN",
    contractMultiplier: "UNKNOWN",
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: true,
    effectiveFrom: "UNKNOWN",
    verificationSource: "UNKNOWN",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "UNKNOWN",
  },
  {
    instrument: "INDIA_VIX",
    exchange: "NSE",
    underlying: "India VIX",
    lotSize: "UNKNOWN",
    tickSize: "UNKNOWN",
    contractMultiplier: "UNKNOWN",
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: false,
    effectiveFrom: "UNKNOWN",
    verificationSource: "PROJECT_METADATA",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "GOLD",
    exchange: "MCX",
    underlying: "Gold Futures",
    lotSize: 100,
    tickSize: 1,
    contractMultiplier: 1,
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: true,
    effectiveFrom: "UNKNOWN",
    verificationSource: "PROJECT_METADATA",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "SILVER",
    exchange: "MCX",
    underlying: "Silver Futures",
    lotSize: 30,
    tickSize: 1,
    contractMultiplier: 1,
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: true,
    effectiveFrom: "UNKNOWN",
    verificationSource: "PROJECT_METADATA",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "CRUDEOIL",
    exchange: "MCX",
    underlying: "Crude Oil Futures",
    lotSize: 100,
    tickSize: 1,
    contractMultiplier: 1,
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: true,
    effectiveFrom: "UNKNOWN",
    verificationSource: "PROJECT_METADATA",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "NATURAL_GAS",
    exchange: "MCX",
    underlying: "Natural Gas Futures",
    lotSize: 1250,
    tickSize: 0.1,
    contractMultiplier: 1,
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: true,
    effectiveFrom: "UNKNOWN",
    verificationSource: "PROJECT_METADATA",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
  {
    instrument: "USDINR",
    exchange: "NSE",
    underlying: "USD/INR",
    lotSize: 1000,
    tickSize: 0.0025,
    contractMultiplier: 1,
    strikeInterval: "UNKNOWN",
    freezeQuantity: "UNKNOWN",
    derivativeSupported: true,
    effectiveFrom: "UNKNOWN",
    verificationSource: "PROJECT_METADATA",
    verifiedAt: "UNKNOWN",
    version: CONTRACT_REGISTRY_VERSION,
    status: "ACTIVE",
  },
];

const AUDITED_HARDCODED_REFERENCES_REMAINING: readonly string[] = deepFreeze([
  "src/lib/portfolio-manager/demo.ts: DEMO NIFTY quantity 75, BANKNIFTY quantity 30, RELIANCE quantity 50",
  "src/lib/portfolio-manager/risk-engine.ts: formula default lotSize 1 when caller omits lotSize",
  "src/lib/backtest/adapters/smc-historical.adapter.ts: backtest execution defaults lotSize 1 and quantity 1",
  "src/lib/broker/broker.test.ts: deterministic test fixture quantities",
]);

const REGISTRY = deepFreeze(CONTRACT_METADATA.map((entry) => ({ ...entry })));
const BY_INSTRUMENT = new Map(REGISTRY.map((entry) => [entry.instrument, entry]));

export function listContractSpecifications(): readonly ContractSpecification[] {
  return REGISTRY.map((entry) => deepFreeze({ ...entry }));
}

export function getContractSpecification(instrument: string): ContractSpecification | null {
  const found = BY_INSTRUMENT.get(instrument);
  return found ? deepFreeze({ ...found }) : null;
}

function effectiveTimestamp(value: string | ContractUnknown): number | null {
  if (value === "UNKNOWN") return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
}

export function getEffectiveContractSpecification(
  instrument: string,
  asOf: string = CONTRACT_REGISTRY_LAST_UPDATED,
  entries: readonly ContractSpecification[] = REGISTRY,
): ContractSpecification | null {
  const asOfTime = effectiveTimestamp(asOf);
  const matches = entries.filter((entry) => entry.instrument === instrument);
  if (matches.length === 0) return null;
  if (asOfTime == null) return deepFreeze({ ...matches[matches.length - 1] });
  const dated = matches
    .map((entry, index) => ({ entry, index, effectiveTime: effectiveTimestamp(entry.effectiveFrom) }))
    .filter((item): item is { entry: ContractSpecification; index: number; effectiveTime: number } => item.effectiveTime != null)
    .filter((item) => item.effectiveTime <= asOfTime)
    .sort((a, b) => b.effectiveTime - a.effectiveTime || a.index - b.index);
  if (dated[0]) return deepFreeze({ ...dated[0].entry });
  const unknown = matches.find((entry) => entry.effectiveFrom === "UNKNOWN");
  return unknown ? deepFreeze({ ...unknown }) : null;
}

export function getContractNumberField(
  instrument: string,
  field: "lotSize" | "tickSize" | "contractMultiplier" | "strikeInterval" | "freezeQuantity",
  asOf?: string,
): number | null {
  const spec = asOf ? getEffectiveContractSpecification(instrument, asOf) : getContractSpecification(instrument);
  const value = spec?.[field];
  return typeof value === "number" ? value : null;
}


export interface ContractLotSizeLookup {
  readonly instrument: string;
  readonly status: "AVAILABLE" | "UNKNOWN";
  readonly lotSize: number | null;
}

export function getContractLotSize(instrument: string, asOf?: string): ContractLotSizeLookup {
  const lotSize = getContractNumberField(instrument, "lotSize", asOf);
  return deepFreeze({
    instrument,
    status: lotSize == null ? "UNKNOWN" : "AVAILABLE",
    lotSize,
  });
}
export function validateContractRegistry(entries: readonly ContractSpecification[] = REGISTRY): readonly ContractRegistryValidationIssue[] {
  const issues: ContractRegistryValidationIssue[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.instrument)) {
      issues.push({ code: "DUPLICATE_INSTRUMENT", instrument: entry.instrument, field: "instrument", message: "Duplicate instrument in contract registry." });
    }
    seen.add(entry.instrument);
    if (entry.exchange === "UNKNOWN" || entry.exchange.length === 0) {
      issues.push({ code: "MISSING_EXCHANGE", instrument: entry.instrument, field: "exchange", message: "Exchange is missing." });
    }
    if (entry.effectiveFrom === "UNKNOWN" || entry.effectiveFrom.length === 0) {
      issues.push({ code: "MISSING_EFFECTIVE_DATE", instrument: entry.instrument, field: "effectiveFrom", message: "Effective date is unknown." });
    }
    if (typeof entry.lotSize === "number" && entry.lotSize <= 0) {
      issues.push({ code: "INVALID_LOT_SIZE", instrument: entry.instrument, field: "lotSize", message: "Lot size must be positive when known." });
    }
    if (typeof entry.contractMultiplier === "number" && entry.contractMultiplier <= 0) {
      issues.push({ code: "ZERO_MULTIPLIER", instrument: entry.instrument, field: "contractMultiplier", message: "Contract multiplier must be positive when known." });
    }
    if (typeof entry.tickSize === "number" && entry.tickSize < 0) {
      issues.push({ code: "NEGATIVE_TICK_SIZE", instrument: entry.instrument, field: "tickSize", message: "Tick size must not be negative when known." });
    }
    if (typeof entry.freezeQuantity === "number" && entry.freezeQuantity <= 0) {
      issues.push({ code: "INVALID_FREEZE_QUANTITY", instrument: entry.instrument, field: "freezeQuantity", message: "Freeze quantity must be positive when known." });
    }
  }
  return deepFreeze(issues.map((issue) => ({ ...issue })));
}

export function getContractRegistryDiagnostics(entries: readonly ContractSpecification[] = REGISTRY): ContractRegistryDiagnostics {
  const issues = validateContractRegistry(entries);
  const duplicateInstruments = issues.filter((issue) => issue.code === "DUPLICATE_INSTRUMENT").map((issue) => issue.instrument).sort();
  const missingFields = issues
    .filter((issue) => issue.code === "MISSING_EXCHANGE" || issue.code === "MISSING_EFFECTIVE_DATE")
    .map((issue) => `${issue.instrument}.${issue.field}`)
    .sort();
  const verifiedInstruments = entries.filter((entry) => entry.verifiedAt !== "UNKNOWN" && entry.verificationSource !== "UNKNOWN").map((entry) => entry.instrument).sort();
  const unverifiedInstruments = entries.filter((entry) => entry.verifiedAt === "UNKNOWN" || entry.verificationSource === "UNKNOWN").map((entry) => entry.instrument).sort();
  const coverage = (field: "lotSize" | "freezeQuantity" | "strikeInterval") =>
    entries.length === 0 ? 0 : Math.round((entries.filter((entry) => typeof entry[field] === "number").length / entries.length) * 10000) / 100;
  const verifiedDates = entries.map((entry) => entry.verifiedAt).filter((date): date is string => date !== "UNKNOWN").sort();
  return deepFreeze({
    registryVersion: CONTRACT_REGISTRY_VERSION,
    registryEntries: entries.length,
    missingFields,
    duplicateInstruments,
    validationStatus: issues.some((issue) => issue.code !== "MISSING_EFFECTIVE_DATE") ? "INVALID" : "VALID",
    lastUpdated: CONTRACT_REGISTRY_LAST_UPDATED,
    sourceType: CONTRACT_REGISTRY_SOURCE_TYPE,
    verifiedInstruments,
    unverifiedInstruments,
    lotSizeCoverage: coverage("lotSize"),
    freezeQuantityCoverage: coverage("freezeQuantity"),
    strikeIntervalCoverage: coverage("strikeInterval"),
    currentRegistryVersion: CONTRACT_REGISTRY_VERSION,
    lastVerificationDate: verifiedDates.at(-1) ?? "UNKNOWN",
    hardcodedReferencesRemaining: AUDITED_HARDCODED_REFERENCES_REMAINING,
  });
}


