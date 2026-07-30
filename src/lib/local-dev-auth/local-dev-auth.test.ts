import { describe, expect, it } from "vitest";
import {
  isClientLocalBypassEnabled,
  isLocalHostname,
  isServerLocalBypassEnabled,
  isTruthyFlag,
  localDevIdentity,
  LOCAL_DEV_EMAIL,
  LOCAL_DEV_USER_ID,
} from "./index";

describe("Phase 52D — local dev auth bypass", () => {
  it("recognises localhost hostnames and host:port pairs", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("localhost:8080")).toBe(true);
    expect(isLocalHostname("127.0.0.1:8080")).toBe(true);
    expect(isLocalHostname("[::1]:8080")).toBe(true);
    expect(isLocalHostname("eagle13.lovable.app")).toBe(false);
    expect(isLocalHostname("localhost.evil.com")).toBe(false);
    expect(isLocalHostname(null)).toBe(false);
  });

  it("parses the flag conservatively", () => {
    expect(isTruthyFlag("true")).toBe(true);
    expect(isTruthyFlag("1")).toBe(true);
    expect(isTruthyFlag("false")).toBe(false);
    expect(isTruthyFlag(undefined)).toBe(false);
  });

  it("enables bypass on localhost when the flag is set", () => {
    expect(
      isServerLocalBypassEnabled({ nodeEnv: "development", host: "localhost:8080", flag: "true" }),
    ).toBe(true);
  });

  it("enables bypass on 127.0.0.1 when the flag is set", () => {
    expect(
      isServerLocalBypassEnabled({ nodeEnv: "development", host: "127.0.0.1:8080", flag: "true" }),
    ).toBe(true);
  });

  it("keeps bypass disabled on localhost when the flag is missing/false", () => {
    expect(
      isServerLocalBypassEnabled({ nodeEnv: "development", host: "localhost:8080", flag: undefined }),
    ).toBe(false);
    expect(
      isServerLocalBypassEnabled({ nodeEnv: "development", host: "localhost:8080", flag: "false" }),
    ).toBe(false);
  });

  it("blocks bypass in production even if the flag is accidentally set", () => {
    expect(
      isServerLocalBypassEnabled({ nodeEnv: "production", host: "localhost:8080", flag: "true" }),
    ).toBe(false);
    expect(
      isServerLocalBypassEnabled({ nodeEnv: "production", host: "eagle13.lovable.app", flag: "true" }),
    ).toBe(false);
  });

  it("blocks bypass for remote hosts in development", () => {
    expect(
      isServerLocalBypassEnabled({ nodeEnv: "development", host: "eagle13.lovable.app", flag: "true" }),
    ).toBe(false);
  });

  it("gates the client bypass on dev + localhost", () => {
    expect(isClientLocalBypassEnabled({ dev: true, hostname: "localhost" })).toBe(true);
    expect(isClientLocalBypassEnabled({ dev: true, hostname: "127.0.0.1" })).toBe(true);
    expect(isClientLocalBypassEnabled({ dev: false, hostname: "localhost" })).toBe(false);
    expect(isClientLocalBypassEnabled({ dev: true, hostname: "eagle13.lovable.app" })).toBe(false);
  });

  it("exposes a safe local identity with no secrets", () => {
    const id = localDevIdentity();
    expect(id).toEqual({
      userId: LOCAL_DEV_USER_ID,
      role: "admin",
      email: LOCAL_DEV_EMAIL,
      displayName: "Local Admin",
      authenticated: true,
    });
    const serialized = JSON.stringify(id);
    expect(serialized).not.toMatch(/key|secret|token|password/i);
  });
});
