import { createFileRoute, redirect } from "@tanstack/react-router";

// Phase 48 — Compatibility redirect: /login → /auth (canonical route).
// Preserves query params (including any `redirect` return URL). Because the
// target route (/auth) is distinct, no redirect loop is possible.
export const Route = createFileRoute("/login")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/auth", search: search as Record<string, unknown> });
  },
  component: () => null,
});