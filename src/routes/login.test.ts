import { describe, it, expect } from "vitest";
import { Route } from "./login";
import { isRedirect } from "@tanstack/react-router";

describe("/login → /auth compatibility redirect", () => {
  it("redirects to /auth preserving search params", () => {
    const opts = Route.options as unknown as { beforeLoad: (ctx: { search: Record<string, unknown> }) => unknown };
    const search = { redirect: "/dashboard", plan: "beta" };
    let caught: unknown = null;
    try {
      opts.beforeLoad({ search });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(isRedirect(caught)).toBe(true);
    const r = caught as { options?: { to?: string; search?: Record<string, unknown> } };
    expect(r.options?.to).toBe("/auth");
    expect(r.options?.search).toEqual(search);
  });
});