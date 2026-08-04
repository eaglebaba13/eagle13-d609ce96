import { describe, expect, it } from "vitest";
import {
  CONTRACT_REGISTRY_VERSION,
  getContractLotSize,
  getContractNumberField,
  getContractRegistryDiagnostics,
  getContractSpecification,
  getEffectiveContractSpecification,
  listContractSpecifications,
  validateContractRegistry,
  type ContractSpecification,
} from "./index";

describe("contract specification registry", () => {
  it("looks up verified NSE contract metadata", () => {
    const nifty = getContractSpecification("NIFTY");
    expect(nifty?.lotSize).toBe(65);
    expect(nifty?.tickSize).toBe(0.05);
    expect(nifty?.strikeInterval).toBe(50);
    expect(nifty?.freezeQuantity).toBe(1800);
    expect(nifty?.verificationSource).toBe("NSE_PUBLIC_CONTRACT_FILES");
    expect(nifty?.version).toBe(CONTRACT_REGISTRY_VERSION);
  });

  it("selects the latest effective record deterministically", () => {
    const base = getContractSpecification("NIFTY") as ContractSpecification;
    const oldRecord: ContractSpecification = { ...base, lotSize: 75, effectiveFrom: "2025-01-01" };
    const newRecord: ContractSpecification = { ...base, lotSize: 65, effectiveFrom: "2025-12-30" };
    expect(getEffectiveContractSpecification("NIFTY", "2025-06-01", [oldRecord, newRecord])?.lotSize).toBe(75);
    expect(getEffectiveContractSpecification("NIFTY", "2026-01-01", [oldRecord, newRecord])?.lotSize).toBe(65);
  });

  it("preserves UNKNOWN metadata and does not assume a fallback lot", () => {
    expect(getContractSpecification("NOT_LISTED")).toBeNull();
    expect(getContractNumberField("SENSEX", "lotSize")).toBeNull();
    expect(getContractLotSize("SENSEX")).toEqual({ instrument: "SENSEX", status: "UNKNOWN", lotSize: null });
    expect(getContractLotSize("NIFTY")).toEqual({ instrument: "NIFTY", status: "AVAILABLE", lotSize: 65 });
  });

  it("keeps registry records immutable and SSR safe", () => {
    const spec = getContractSpecification("NIFTY");
    expect(typeof window).toBe("undefined");
    expect(() => {
      (spec as { lotSize: number }).lotSize = 1;
    }).toThrow();
  });

  it("detects duplicates and invalid values deterministically", () => {
    const base = getContractSpecification("NIFTY") as ContractSpecification;
    const issues = validateContractRegistry([
      base,
      { ...base },
      { ...base, instrument: "BAD_LOT", lotSize: 0, contractMultiplier: 0, tickSize: -1, freezeQuantity: 0, exchange: "UNKNOWN", effectiveFrom: "UNKNOWN" },
    ]);
    expect(issues.map((issue) => issue.code)).toEqual([
      "DUPLICATE_INSTRUMENT",
      "MISSING_EXCHANGE",
      "MISSING_EFFECTIVE_DATE",
      "INVALID_LOT_SIZE",
      "ZERO_MULTIPLIER",
      "NEGATIVE_TICK_SIZE",
      "INVALID_FREEZE_QUANTITY",
    ]);
  });

  it("builds safe diagnostics with coverage and audited remaining references", () => {
    const diagnostics = getContractRegistryDiagnostics();
    expect(diagnostics.registryEntries).toBe(listContractSpecifications().length);
    expect(diagnostics.sourceType).toMatch(/EXCHANGE_METADATA/);
    expect(diagnostics.verifiedInstruments).toEqual(["BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTY"]);
    expect(diagnostics.unverifiedInstruments).toContain("SENSEX");
    expect(diagnostics.lotSizeCoverage).toBeGreaterThan(0);
    expect(diagnostics.freezeQuantityCoverage).toBeGreaterThan(0);
    expect(diagnostics.strikeIntervalCoverage).toBeGreaterThan(0);
    expect(diagnostics.hardcodedReferencesRemaining.length).toBeGreaterThan(0);
    expect(JSON.stringify(diagnostics)).not.toMatch(/token|secret|authorization|cookie/i);
  });

  it("keeps existing project metadata fallback values for non-index instruments", () => {
    expect(getContractSpecification("GOLD")?.lotSize).toBe(100);
    expect(getContractSpecification("GOLD")?.verificationSource).toBe("PROJECT_METADATA");
    expect(getContractSpecification("BANKEX")?.exchange).toBe("BSE");
  });
});
