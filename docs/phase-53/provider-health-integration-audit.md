# Phase 53B — Provider Health Integration Audit

Additive integration only. No existing calculation, contract, cache
namespace, query key or Run ID was modified.

## Integration matrix

| Consumer module | Route / component | Provider(s) | Cache namespace | Freshness handling | Quality handling | Prod / mock | Integration status | Risk |
|---|---|---|---|---|---|---|---|---|
| `market.functions.ts` (NIFTY/BANKNIFTY/VIX) | `/`, `/live-market-terminal`, dashboards | Upstox (primary) → Yahoo (secondary) | existing TanStack Query keys (unchanged) | timestamp in response | existing degraded fallback | production | Registry hooks via `instrumentProviderCall` wrapper (opt-in) | low |
| `upstox-http.server.ts` — option chain | `/options-chain`, `/options-analytics`, decision engines | Upstox | existing | expiry validation | HTTP status → code | production | Adapter-ready | low |
| Combined PCR | `/combined-pcr` | Upstox option chain | existing | derived | derived | production | Adapter-ready | low |
| Market Breadth | `/market-breadth` | Yahoo (top-10 Nifty50) | existing | Yahoo timestamps | success rate | production | Adapter-ready | low |
| Institutional Intelligence | `/institutional-intelligence` | Yahoo + Upstox | existing | timestamps | success rate | production | Adapter-ready | medium |
| CoinDCX dashboard | `/crypto` | CoinDCX | existing | server-side ts | schema validation | production | Adapter-ready | low |
| Gold/Silver ratio | dashboard widget | Yahoo (GC=F, SI=F) | existing | Yahoo ts | ratio bounds | production | Adapter-ready | low |
| Morning Brief pipeline | `/api/public/hooks/morning-brief` | Yahoo / Upstox / CoinDCX | server memo | per-source ts | quality codes | production | Adapter-ready | low |
| Mock / demo providers | tests, previews only | in-repo mocks | none | n/a | n/a | dev/test only | Blocked in production via `assertProductionProvider` | none |

## Confirmations

- No fabricated fallback data introduced.
- Explicit `UNAVAILABLE` retained for every failure path.
- No renames, removed fields, or changed cache namespaces.
- SSR-safe: registry state is per-worker, module-scope only; no browser globals in server paths.
- Provenance is exposed on the reserved additive `__provenance` field so strictly-typed consumers are unaffected.

## Follow-up (non-blocking)

- Wrap individual live fetchers with `instrumentProviderCall` incrementally.
- Bridge more registry codes into `runtime-readiness` diagnostics as taxonomy evolves.