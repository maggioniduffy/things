import { describe, expect, it } from "vitest";
import { resolveAuthRedirect, safeNextPath } from "./proxy";

const user = { is_anonymous: false };
const guest = { is_anonymous: true };

describe("resolveAuthRedirect", () => {
  const cases = [
    {
      name: "signed out on /app",
      pathname: "/app",
      search: "",
      claims: null,
      to: "/login?next=%2Fapp",
    },
    {
      name: "signed out on a nested route keeps path and query",
      pathname: "/app/c/123",
      search: "?item=9",
      claims: null,
      to: "/login?next=%2Fapp%2Fc%2F123%3Fitem%3D9",
    },
    { name: "signed in on /app", pathname: "/app", search: "", claims: user, to: null },
    { name: "guest on /app", pathname: "/app/all", search: "", claims: guest, to: null },
    { name: "signed in on /login", pathname: "/login", search: "", claims: user, to: "/app" },
    { name: "guest on /login stays", pathname: "/login", search: "", claims: guest, to: null },
    { name: "signed out on /login stays", pathname: "/login", search: "", claims: null, to: null },
    { name: "signed in on /", pathname: "/", search: "", claims: user, to: "/app" },
    { name: "guest on / stays", pathname: "/", search: "", claims: guest, to: null },
    { name: "signed out on /", pathname: "/", search: "", claims: null, to: null },
    { name: "/apple is not /app", pathname: "/apple", search: "", claims: null, to: null },
    {
      name: "/application is not /app",
      pathname: "/application",
      search: "",
      claims: null,
      to: null,
    },
  ];

  it.each(cases)("$name", ({ pathname, search, claims, to }) => {
    expect(resolveAuthRedirect({ pathname, search, claims })).toBe(to);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/app", "/app"],
    ["/app/c/1?item=2", "/app/c/1?item=2"],
    ["//evil.com", null],
    ["/\\evil.com", null],
    ["https://evil.com", null],
    ["app", null],
    ["/\t/evil.com", null],
    ["/\n/evil.com", null],
    ["/\r/evil.com", null],
    ["/\u0000/evil.com", null],
    ["/app\\..\\evil", null],
    ["/%2F%2Fevil.com", "/%2F%2Fevil.com"],
    ["/app/../login", "/login"],
    ["/app#top", "/app#top"],
    ["", null],
    [null, null],
    [undefined, null],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
