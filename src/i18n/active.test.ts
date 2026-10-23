import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveMessages, setActiveLocale } from "./active";
import { messages } from "./messages";

describe("active locale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setActiveLocale("en");
  });

  it("follows setActiveLocale in the browser", () => {
    setActiveLocale("es");
    expect(getActiveMessages()).toBe(messages.es);
  });

  it("ignores setActiveLocale on the server", () => {
    vi.stubGlobal("window", undefined);
    setActiveLocale("es");
    vi.unstubAllGlobals();
    expect(getActiveMessages()).toBe(messages.en);
  });

  it("throws on the server in development", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("NODE_ENV", "development");
    expect(() => getActiveMessages()).toThrow("use useT()/getT()");
  });

  it("returns English on the server in production", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(getActiveMessages()).toBe(messages.en);
  });
});
