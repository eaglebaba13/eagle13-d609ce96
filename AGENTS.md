<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history â€” force pushing, or rebasing/amending/squashing commits
> that are already pushed â€” as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# EagleBABA AI Agent Guide

## Mission

Maintain and extend EagleBABA without changing deterministic trading formulas.

## Golden Rules

- Search before creating.
- Extend existing modules.
- Never modify Astro/Gann/GTI formulas.
- Never expose secrets.
- Keep changes incremental.
- Run tests.
- Run production build.
- Explain every file changed.
- Prefer composition over duplication.
- Preserve backward compatibility.

## Required Before Completion

- Targeted tests pass.
- Build passes.
- No secrets leaked.
- No unnecessary files added.
- No duplicated functionality.

## Authoritative Project Policy

Use AGENTS.md as the authoritative project-development policy.

Treat:

- `src/` as the primary application codebase.
- `supabase/` as the only location for database migrations and schema changes.
- `docs/` as the location for architecture, phase reports, and operational documentation.
- `services/` as independent supporting services that must not be modified unless explicitly in scope.

Never edit generated or dependency directories:

- `node_modules/`
- `.output/`
- `.wrangler/`

Never inspect, print, serialize, or commit:

- `.env`
- `.env.local`
- `env.txt`
- API keys
- tokens
- secrets

Before creating any route, component, helper, hook, provider, table, or migration:

1. Search for an existing implementation.
2. Reuse or extend it where possible.
3. Explain the planned change.
4. Keep the diff minimal.
5. Run targeted tests.
6. Run the production build.

## Detailed Operating Manual

You are working on the EagleBABA Institutional Trading Platform. Treat this
repository as a production-grade financial intelligence system, not a demo app
or generic SaaS project.

## Platform Stack

- TanStack Start
- React 19
- TypeScript
- Vite
- TailwindCSS v4
- Supabase
- Vitest
- React Query
- Lovable-connected deployment workflow

## Product Direction

Build EagleBABA as a premium institutional trading workstation:

- Dark luxury trading terminal.
- Data-dense analyst cockpit.
- Serious financial intelligence interface.
- Compact, sharp, responsive, execution-focused UI.
- Practical astro/market timing as an analytical layer, never as guaranteed prediction.

Avoid:

- Marketing landing-page patterns unless explicitly requested.
- Generic SaaS dashboards.
- Cartoonish, bubbly, neon, or gradient-heavy visuals.
- Decorative UI that does not improve decision clarity.

## Non-Negotiable Trading Safety

Never modify existing trading formulas unless the user explicitly asks for that
specific formula change.

Protected logic includes:

- Astro calculations
- Gann calculations
- GTI logic
- SMC engines
- Hybrid engines
- Institutional Flow
- Decision Center
- Backtester
- Risk Engine
- Formula versions
- Run ID generation
- Level ranking
- CPR, pivot, Fibonacci, and confluence calculations

If a task touches these areas, first identify the existing implementation,
preserve deterministic behavior, and add or update tests around the exact
behavior being changed.

## Search Before Creating

Before creating any new file, route, component, hook, provider, helper, utility,
or data model:

1. Search the existing codebase.
2. Identify the closest existing module or pattern.
3. Prefer extending the existing implementation.
4. Avoid duplicate abstractions.

Do not add new top-level directories unless clearly necessary.

## Change Discipline

Keep changes incremental and production-safe:

- Small diffs.
- Minimal refactors.
- No unrelated formatting churn.
- No renaming unless required.
- No architecture changes without a clear reason.
- No rewriting working modules.
- No changes to published git history.

Respect user work already present in the tree. Never revert changes you did not
make unless explicitly instructed.

## API And Compatibility Contracts

Preserve existing contracts:

- Component props
- Existing exports
- Route paths and route contracts
- React Query keys
- Cache namespaces
- Run IDs
- Formula versions
- Supabase schema expectations
- Server function payload shapes
- Diagnostic export formats

When changing shared code, verify downstream usage before editing.

## Security And Secrets

Never expose, log, serialize, print, or commit:

- Supabase keys
- Service role keys
- Upstox tokens
- Broker tokens
- API secrets
- Authorization headers
- Cookies
- Environment variables
- Webhook secrets

Diagnostics must redact credentials and provide safe summaries only.

## Persistence Rules

Persistence must be:

- Side-effect only
- Non-blocking
- Idempotent
- Immutable where practical
- Bounded
- Safe to fail

Persistence failure must never change a trading decision, formula result, signal,
or risk verdict.

## Broker And Execution Safety

Never introduce live trading side effects without explicit instruction:

- No automatic order execution.
- No broker writes.
- No live trade placement.
- No hidden mutation of external broker state.

Paper trading, simulations, and dry-run flows must be clearly separated from
live execution.

## TypeScript Standards

Maintain strict TypeScript discipline:

- Avoid `any`.
- Avoid `@ts-ignore`.
- Avoid unsafe casts.
- Prefer explicit interfaces for domain payloads.
- Keep server-only code in `.server.ts` modules where applicable.
- Keep client code SSR-safe.

Browser globals such as `window`, `document`, and `localStorage` require browser
guards.

## UI Standards

All UI work must fit EagleBABA's institutional terminal style:

- Dark-mode-first.
- Deep charcoal/navy surfaces.
- Gold/amber primary accents.
- Teal for neutral or time markers.
- Green for bullish conditions.
- Red for bearish conditions.
- Compact typography.
- Tabular financial numbers.
- Dense but readable panels, tables, ladders, scorecards, and matrices.
- Clear hierarchy for bias, trigger, invalidation, target, risk, timing, and confluence.

Every UI change must support desktop, laptop, tablet, and mobile. Avoid
unintended horizontal scrolling.

Accessibility requirements:

- Keyboard navigation.
- Visible focus states.
- ARIA labels for icon-only controls.
- Sufficient contrast.
- Semantic HTML where practical.

## Performance Rules

Avoid:

- Duplicate fetches.
- Unnecessary rerenders.
- Large bundle additions.
- Expensive synchronous work on hot paths.
- New dependencies unless they add clear value.

Use existing React Query patterns and cache contracts.

## Testing And Verification

For every code change:

1. Run targeted Vitest tests for the affected module.
2. If shared logic changes, run the affected suite.
3. Before completion, run `npm run build` unless the user explicitly scoped the
   task to analysis only or there is a documented blocker.

Never claim tests or builds passed unless they were actually executed.

## Standard Workflow

For each implementation task:

1. Search existing implementation.
2. State the implementation approach when the change is non-trivial.
3. Implement incrementally.
4. Run targeted tests.
5. Run production build.
6. Summarize files changed, tests run, build result, compatibility impact, and
   known risks.

For analysis-only tasks, do not edit files.

## Final Response Format For Code Changes

After completing a code task, report:

- Summary
- Files Modified
- Files Added
- Tests Run
- Build Status
- Known Risks
- Next Recommended Step

If no code changed, say that clearly.

## Priority Order

When tradeoffs arise, optimize in this order:

1. Correctness
2. Determinism
3. Backward compatibility
4. Security
5. Performance
6. Developer experience

## Final Principle

Preserve EagleBABA's institutional-grade architecture. When uncertain, search
first, reuse existing code, keep the diff small, and never break existing
trading behavior.



