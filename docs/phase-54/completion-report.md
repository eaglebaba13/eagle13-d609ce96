# Phase 54 — Institutional Options Analytics (Research Layer)

## Files added
- `src/lib/options-analytics/*.ts` (types, max-pain, gamma-exposure, gamma-walls, dealer-positioning, oi-buildup, iv-rank, iv-percentile, expected-move, volatility-regime, support-resistance, market-structure, confidence, reports, index)
- `src/lib/options-analytics/options-analytics.test.ts` (24 tests)
- `src/routes/_authenticated/options-analytics.tsx`
- `docs/phase-54/{architecture,formulas,assumptions,completion-report}.md`

## Files modified
- `src/lib/navigation.ts` — additive RESEARCH nav entry.

## Formulas
- Max Pain: Σ callOI·max(K−S,0) + putOI·max(S−K,0), deterministic tie-break.
- GEX: (γc·OIc − γp·OIp)·spot²·0.01; cumulative sign-cross → flip.
- Walls: |ΔGEX| per strike, split around spot.
- Dealer posture: sign(net γ) → LONG/SHORT/NEUTRAL.
- Build-up: leg-level ΔOI classifier; NEUTRAL when direction unknown.
- IV Rank/Pct/Regime; Expected Move = spot·IV·√(DTE/365).
- Confidence: weighted blend of provider quality, chain/OI/IV/gamma coverage, expiry.

## Providers
Provider-neutral over canonical `OptionChainSnapshot` (Upstox + MOCK).

## Tests
48 passing in options-analytics suites (24 new). No existing tests altered.

## Architecture / backward compatibility
Additive only. Astro/Gann/GTI/SMC/Hybrid/Decision/Backtester untouched. No query keys, cache namespaces or Run IDs modified.
