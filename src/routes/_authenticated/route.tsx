import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Public research subtree.
 *
 * Authentication/subscription gating has been removed from normal research
 * routes. Admin capabilities remain protected by their own server-side
 * authorization checks.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => <Outlet />,
});
