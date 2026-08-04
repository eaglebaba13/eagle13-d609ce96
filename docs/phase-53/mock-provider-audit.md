# Phase 53 — Mock Provider Audit

Read-only survey of every data provider surface. No formulas modified.

| Module | Current Provider | Live / Mock | Missing Fields | Replacement | Risk |
| --- | --- | --- | --- | --- | --- |
| `market.functions.ts` (NIFTY/BANKNIFTY/VIX) | Upstox → Yahoo fallback | LIVE | – | – | Low |
| `market.functions.ts` (GC=F / SI=F) | Yahoo | LIVE | intraday tick | – | Low |
| `institutional-intelligence/yahoo-quote.server.ts` | Yahoo (Nifty50 + sectors) | LIVE | volume | – | Low |
| `option-chain/upstox-provider.server.ts` | Upstox | LIVE | – | – | Low |
| `option-chain/mock-provider.ts` | In-memory fixture | MOCK | – | Dev/tests only — not registered in prod | Low |
| `institutional-intelligence` FII/DII (`RESEARCH_FLOW`) | Placeholder | RESEARCH | tradeDate, fiiNet, diiNet | NSE/BSE official feed | Medium |
| `institutional-intelligence` News (`RESEARCH_NEWS`) | Placeholder | RESEARCH | headline stream | Verified news provider | Medium |
| `market-intelligence/global-markets` | Yahoo indices | LIVE | – | – | Low |
| `market-intelligence/macro` | Yahoo (DXY/US10Y/BRENT) | LIVE | – | – | Low |
| `providers/coindcx/*` | CoinDCX REST | LIVE | – | – | Low |
| `multi-asset/report-composer` Gann/Astro (XAU/XAG/BTC/ETH) | Not connected | UNAVAILABLE | – | Documented limitation | Low |
| `services/tradingview-ratio-collector` | External Node collector | External | – | – | Low |
| `portfolio-manager/*` | Local demo store | DEMO | – | Explicit demo mode | Low |
| `strategy-builder/dataset` | User CSV import | User-supplied | – | – | Low |

No unmarked mock data reaches production surfaces. Placeholders
(`RESEARCH_FLOW`, `RESEARCH_NEWS`, unavailable Gann/Astro for
XAU/XAG/BTC/ETH) already declare `OFFICIAL_SOURCE_REQUIRED` /
`UNAVAILABLE` states — they are never fabricated.