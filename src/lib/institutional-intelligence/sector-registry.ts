// Phase 49 — Sector index registry for live rotation. Yahoo Finance
// tickers are best-effort; per-sector fetch failures degrade gracefully
// and are surfaced as PROVIDER_PENDING rather than fabricated.

export const II_SECTOR_REGISTRY_VERSION = "ii-sector-registry@2025-01-30";

export interface SectorIndexDef {
  readonly id: string;
  readonly label: string;
  readonly yahooSymbol: string;
}

export const II_SECTOR_REGISTRY: readonly SectorIndexDef[] = [
  { id: "BANKING",   label: "Banking",            yahooSymbol: "^NSEBANK" },
  { id: "IT",        label: "IT",                 yahooSymbol: "^CNXIT" },
  { id: "FIN_SVC",   label: "Financial Services", yahooSymbol: "NIFTY_FIN_SERVICE.NS" },
  { id: "AUTO",      label: "Auto",               yahooSymbol: "^CNXAUTO" },
  { id: "FMCG",      label: "FMCG",               yahooSymbol: "^CNXFMCG" },
  { id: "PHARMA",    label: "Pharma",             yahooSymbol: "^CNXPHARMA" },
  { id: "METAL",     label: "Metal",              yahooSymbol: "^CNXMETAL" },
  { id: "REALTY",    label: "Realty",             yahooSymbol: "^CNXREALTY" },
  { id: "OIL_GAS",   label: "Oil & Gas",          yahooSymbol: "^CNXENERGY" },
  { id: "PSU_BANK",  label: "PSU Bank",           yahooSymbol: "^CNXPSUBANK" },
  { id: "ENERGY",    label: "Energy",             yahooSymbol: "^CNXENERGY" },
  { id: "CAP_GOODS", label: "Capital Goods",      yahooSymbol: "^CNXINFRA" },
];