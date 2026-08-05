import { describe, expect, it } from "vitest";
import { marketQuery } from "./index";

describe("homepage SSR market query", () => {
  it("does not use the global multi-retry budget", () => {
    expect(marketQuery().retry).toBe(false);
  });
});
