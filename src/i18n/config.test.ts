import { describe, expect, it } from "vitest";
import { resolveLocale } from "./config";

describe("resolveLocale", () => {
  it("lets the cookie win over host and language", () => {
    expect(resolveLocale({ cookie: "en", host: "cosa.teca.plus", acceptLanguage: "es-AR" })).toBe(
      "en",
    );
    expect(resolveLocale({ cookie: "es", host: "thing.teca.plus" })).toBe("es");
  });

  it("maps the cosa. and thing. hosts", () => {
    expect(resolveLocale({ host: "cosa.teca.plus", acceptLanguage: "en-US" })).toBe("es");
    expect(resolveLocale({ host: "thing.teca.plus", acceptLanguage: "es" })).toBe("en");
  });

  it("falls back to the first Accept-Language entry", () => {
    expect(
      resolveLocale({ host: "localhost:3000", acceptLanguage: "es-AR,es;q=0.9,en;q=0.8" }),
    ).toBe("es");
    expect(resolveLocale({ acceptLanguage: "en-GB,es;q=0.5" })).toBe("en");
  });

  it("defaults to English", () => {
    expect(resolveLocale({})).toBe("en");
    expect(resolveLocale({ host: "localhost", acceptLanguage: "fr-FR" })).toBe("en");
  });

  it("ignores an invalid cookie", () => {
    expect(resolveLocale({ cookie: "fr", host: "cosa.teca.plus" })).toBe("es");
    expect(resolveLocale({ cookie: "", acceptLanguage: "es" })).toBe("es");
  });
});
