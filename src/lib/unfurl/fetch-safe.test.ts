// @vitest-environment node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import net from "node:net";
import tls from "node:tls";
import type dns from "node:dns";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BlockedUrlError,
  fetchSafe,
  guardedLookup,
  isPublicAddress,
  UnreachableError,
  type RealLookup,
} from "./fetch-safe";
import { parseHead } from "./parse";

/** A stand-in for `dns.lookup` that answers from a table (the wrapper always asks for `all: true`). */
function fakeLookup(table: Record<string, string[]>): typeof dns.lookup {
  const lookup: RealLookup = (hostname, _options, callback) => {
    const addresses = table[hostname];
    if (!addresses) {
      const error: NodeJS.ErrnoException = new Error(`ENOTFOUND ${hostname}`);
      error.code = "ENOTFOUND";
      return callback(error, []);
    }
    callback(
      null,
      addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
    );
  };
  return lookup as unknown as typeof dns.lookup;
}

describe("isPublicAddress", () => {
  const cases: [string, boolean][] = [
    ["8.8.8.8", true],
    ["1.1.1.1", true],
    ["2606:4700:4700::1111", true],
    ["[2606:4700:4700::1111]", true],
    ["127.0.0.1", false],
    ["10.0.0.1", false],
    ["172.16.0.1", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["192.0.2.1", false],
    ["198.51.100.7", false],
    ["224.0.0.1", false],
    ["255.255.255.255", false],
    ["0.0.0.0", false],
    ["::", false],
    ["::1", false],
    ["[::1]", false],
    ["::ffff:127.0.0.1", false],
    ["::ffff:8.8.8.8", true],
    ["fc00::1", false],
    ["fd12:3456::1", false],
    ["fe80::1", false],
    ["ff02::1", false],
    ["not an ip", false],
    ["", false],
  ];
  it.each(cases)("%s -> %s", (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });
});

describe("guardedLookup", () => {
  const publicOnly = (ip: string) => ip === "93.184.216.34";
  const lookupOf = (addresses: string[]) =>
    ((_host, _options, callback) =>
      callback(
        null,
        addresses.map((address) => ({ address, family: 4 })),
      )) as RealLookup;

  it("answers in the all:true form", () => {
    const callback = vi.fn();
    guardedLookup(lookupOf(["93.184.216.34"]), publicOnly)("x.test", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
  });

  it("answers in the single-address form", () => {
    const callback = vi.fn();
    guardedLookup(lookupOf(["93.184.216.34"]), publicOnly)("x.test", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });

  it.each([{ all: true }, {}])("rejects a private answer (%o)", (options) => {
    const callback = vi.fn();
    guardedLookup(lookupOf(["10.0.0.1"]), publicOnly)("x.test", options, callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(BlockedUrlError);
  });

  it("rejects when any one of several answers is private", () => {
    const callback = vi.fn();
    guardedLookup(lookupOf(["93.184.216.34", "10.0.0.1"]), publicOnly)("x.test", {}, callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(BlockedUrlError);
  });

  it("passes DNS errors through", () => {
    const callback = vi.fn();
    const failing: RealLookup = (_host, _options, cb) => cb(new Error("ENOTFOUND"), []);
    guardedLookup(failing, publicOnly)("x.test", {}, callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0]?.[0]).not.toBeInstanceOf(BlockedUrlError);
  });
});

describe("fetchSafe blocks unsafe targets", () => {
  afterEach(() => vi.restoreAllMocks());

  const blockedLiterals = [
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/",
    "http://0x7f.1/",
    "http://10.0.0.1/",
    "http://[fe80::1]/",
    "http://100.64.0.1/",
    "https://192.168.0.1/",
  ];

  it.each(blockedLiterals)("%s is rejected before any lookup or socket", async (url) => {
    const lookup = vi.fn();
    const netConnect = vi.spyOn(net, "connect");
    const tlsConnect = vi.spyOn(tls, "connect");
    await expect(fetchSafe(url, { lookup: lookup as never })).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
    expect(lookup).not.toHaveBeenCalled();
    expect(netConnect).not.toHaveBeenCalled();
    expect(tlsConnect).not.toHaveBeenCalled();
  });

  it.each(["http://example.com:22/", "http://example.com:8080/", "https://example.com:8443/"])(
    "%s is rejected for its port",
    async (url) => {
      const lookup = vi.fn();
      await expect(fetchSafe(url, { lookup: lookup as never })).rejects.toBeInstanceOf(
        BlockedUrlError,
      );
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it.each(["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "not a url"])(
    "%s is rejected for its scheme",
    async (url) => {
      await expect(fetchSafe(url)).rejects.toBeInstanceOf(BlockedUrlError);
    },
  );

  it("rejects URLs with credentials", async () => {
    await expect(fetchSafe("http://user:pw@example.com/")).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("rejects http://localhost/ through the real resolver (loopback)", async () => {
    await expect(fetchSafe("http://localhost/")).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("rejects a hostname whose lookup returns a private address (rebinding)", async () => {
    const lookup = fakeLookup({ "rebind.test": ["10.0.0.5"] });
    await expect(fetchSafe("http://rebind.test/", { lookup })).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it("rejects a hostname whose lookup returns one public and one private address", async () => {
    const lookup = fakeLookup({ "mixed.test": ["93.184.216.34", "192.168.0.10"] });
    await expect(fetchSafe("http://mixed.test/", { lookup })).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it("reports an unresolvable host as unreachable, not blocked", async () => {
    const lookup = fakeLookup({});
    await expect(fetchSafe("http://nowhere.test/", { lookup })).rejects.toBeInstanceOf(
      UnreachableError,
    );
  });
});

describe("fetchSafe against a local server", () => {
  const hits: string[] = [];
  const pending: ServerResponse[] = [];
  let server: Server;
  let port: number;

  const html = (head: string) =>
    `<!doctype html><html><head>${head}</head><body><p>body</p></body></html>`;

  function handle(request: IncomingMessage, response: ServerResponse) {
    const path = request.url ?? "/";
    hits.push(path);
    const send = (status: number, headers: Record<string, string>, body = "") => {
      response.writeHead(status, headers);
      response.end(body);
    };
    const page = { "Content-Type": "text/html; charset=utf-8" };

    if (path === "/page") {
      return send(
        200,
        page,
        html(
          '<title>Local</title><meta property="og:description" content="From the server">' +
            '<link rel="icon" href="/i.png">',
        ),
      );
    }
    if (path === "/to-metadata") return send(302, { Location: "http://169.254.169.254/" });
    if (path === "/to-private-host") return send(302, { Location: `http://evil.test:${port}/` });
    if (path === "/relative") return send(301, { Location: "/page" });
    if (path.startsWith("/chain/")) {
      const n = Number(path.slice("/chain/".length));
      return n === 0
        ? send(200, page, html("<title>End of chain</title>"))
        : send(302, { Location: `/chain/${n - 1}` });
    }
    if (path === "/big") {
      response.writeHead(200, page);
      return response.end("<html><head><title>Big</title>" + "a".repeat(2_000_000));
    }
    if (path === "/slow") {
      pending.push(response); // never answered
      return;
    }
    if (path === "/head-then-hang") {
      response.writeHead(200, page);
      response.write("<html><head><title>Early</title></HEAD>\n<body>");
      pending.push(response); // the rest of the body never arrives
      return;
    }
    if (path === "/pdf") return send(200, { "Content-Type": "application/pdf" }, "%PDF-1.4 ...");
    if (path === "/json") return send(200, { "Content-Type": "application/json" }, '{"a":1}');
    if (path === "/missing") return send(404, page, "nope");
    send(500, page);
  }

  beforeAll(async () => {
    server = createServer(handle);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    pending.forEach((response) => response.destroy());
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    hits.length = 0;
  });

  // Tests may connect to 127.0.0.1 (and only that) on the server's port.
  const lookup = fakeLookup({
    "site.test": ["127.0.0.1"],
    "evil.test": ["10.0.0.9"],
  });
  const allowLoopback = (ip: string) => ip === "127.0.0.1" || isPublicAddress(ip);
  const options = (extra: Parameters<typeof fetchSafe>[1] = {}) => ({
    lookup,
    isAllowed: allowLoopback,
    allowedPorts: [port],
    ...extra,
  });
  const url = (path: string) => `http://site.test:${port}${path}`;

  it("fetches HTML and the result parses", async () => {
    const result = await fetchSafe(url("/page"), options());
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe(url("/page"));
    expect(result.contentType).toContain("text/html");
    const head = parseHead(result.body, result.finalUrl);
    expect(head.title).toBe("Local");
    expect(head.description).toBe("From the server");
    expect(head.faviconUrl).toBe(`http://site.test:${port}/i.png`);
  });

  it("rejects the same server when the default allowlist applies (pins the checked address)", async () => {
    await expect(fetchSafe(url("/page"), { lookup, allowedPorts: [port] })).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
    expect(hits).toEqual([]);
  });

  it("follows a relative redirect and reports the final URL", async () => {
    const result = await fetchSafe(url("/relative"), options());
    expect(result.finalUrl).toBe(url("/page"));
    expect(hits).toEqual(["/relative", "/page"]);
  });

  it("rejects a redirect to the cloud metadata address", async () => {
    await expect(fetchSafe(url("/to-metadata"), options())).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("rejects a redirect to a host that resolves to a private address", async () => {
    await expect(fetchSafe(url("/to-private-host"), options())).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });

  it("follows exactly three redirects but not four", async () => {
    const ok = await fetchSafe(url("/chain/3"), options());
    expect(ok.finalUrl).toBe(url("/chain/0"));
    await expect(fetchSafe(url("/chain/4"), options())).rejects.toBeInstanceOf(UnreachableError);
  });

  it("truncates bodies at maxBytes", async () => {
    const result = await fetchSafe(url("/big"), options());
    expect(Buffer.byteLength(result.body)).toBe(1_000_000);
    const small = await fetchSafe(url("/big"), options({ maxBytes: 5000 }));
    expect(Buffer.byteLength(small.body)).toBe(5000);
  });

  it("times out on a server that never answers", async () => {
    const started = Date.now();
    await expect(fetchSafe(url("/slow"), options({ timeoutMs: 200 }))).rejects.toBeInstanceOf(
      UnreachableError,
    );
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("stops reading at </head> instead of waiting for the rest of the body", async () => {
    const result = await fetchSafe(url("/head-then-hang"), options({ timeoutMs: 3000 }));
    expect(result.body).toContain("<title>Early</title>");
    expect(parseHead(result.body, result.finalUrl).title).toBe("Early");
  });

  it("treats non-2xx as unreachable", async () => {
    await expect(fetchSafe(url("/missing"), options())).rejects.toBeInstanceOf(UnreachableError);
  });

  it("does not download non-text bodies", async () => {
    const result = await fetchSafe(url("/pdf"), options());
    expect(result).toMatchObject({ status: 200, contentType: "application/pdf", body: "" });
  });

  it("reads JSON bodies", async () => {
    const result = await fetchSafe(url("/json"), options({ accept: "application/json" }));
    expect(JSON.parse(result.body)).toEqual({ a: 1 });
  });
});
