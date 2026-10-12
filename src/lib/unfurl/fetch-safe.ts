// Server-only: SSRF-guarded HTTP fetch for /api/unfurl. (No `import "server-only"`: it throws
// under vitest, and this module is only imported by the route handler and its tests.)
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";

/** The URL, or a redirect target, points somewhere the server must not connect to. */
export class BlockedUrlError extends Error {
  constructor(message = "URL is not allowed") {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/** Timeout, DNS failure, non-2xx, too many redirects, connection error. */
export class UnreachableError extends Error {
  constructor(message = "URL is unreachable") {
    super(message);
    this.name = "UnreachableError";
  }
}

/**
 * True only for globally routable unicast addresses. An allowlist: private, loopback, link-local,
 * CGNAT, unique-local, multicast, reserved, documentation ranges, `::` and `0.0.0.0` all fail.
 * `ipaddr.process` unwraps IPv4-mapped IPv6 (`::ffff:127.0.0.1`) first.
 */
export function isPublicAddress(ip: string): boolean {
  const bare = ip.trim().replace(/^\[|\]$/g, "");
  if (!ipaddr.isValid(bare)) return false;
  try {
    return ipaddr.process(bare).range() === "unicast";
  } catch {
    return false;
  }
}

export type SafeFetchOptions = {
  /** Body cap in bytes (default 1_000_000). */
  maxBytes?: number;
  /** One overall deadline for connect, headers and body (default 5000). */
  timeoutMs?: number;
  /** Redirects followed before giving up (default 3). */
  maxRedirects?: number;
  accept?: string;
  /** Test seams. */
  lookup?: typeof dns.lookup;
  isAllowed?: (ip: string) => boolean;
  allowedPorts?: number[];
};

export type SafeFetchResult = {
  finalUrl: string;
  status: number;
  contentType: string | null;
  /** UTF-8 text, cut at `maxBytes`; for HTML, reading stops once `</head>` has been seen. */
  body: string;
};

const DEFAULT_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type LookupAddress = { address: string; family: number };
export type RealLookup = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

/**
 * A `lookup` for the undici connector that resolves normally but refuses the connection when ANY
 * resolved address is not allowed. The address undici connects to is the one checked here, so a
 * DNS answer that changes between "check" and "connect" (rebinding) cannot slip through.
 */
export function guardedLookup(
  realLookup: RealLookup,
  isAllowed: (ip: string) => boolean,
): LookupFunction {
  return (hostname, options, callback) => {
    realLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "", 0);
      if (addresses.length === 0 || addresses.some((entry) => !isAllowed(entry.address))) {
        return callback(new BlockedUrlError("Host resolves to a blocked address"), "", 0);
      }
      // Node 22 asks for `all: true` (autoSelectFamily); older call styles want a single address.
      if (options.all) return callback(null, addresses);
      const chosen = addresses[0] as LookupAddress;
      return callback(null, chosen.address, chosen.family);
    });
  };
}

/** Throws BlockedUrlError unless the URL is http(s) on a default port with an allowed IP literal. */
function assertAllowedTarget(
  url: URL,
  options: Required<Pick<SafeFetchOptions, "isAllowed" | "allowedPorts">>,
) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("Only http and https URLs are allowed");
  }
  if (url.username || url.password)
    throw new BlockedUrlError("URLs with credentials are not allowed");

  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port);
  if (!options.allowedPorts.includes(port)) throw new BlockedUrlError("Port is not allowed");

  // IP literals never reach `lookup`, so check them here (WHATWG URL already normalised
  // decimal/hex forms like 2130706433 and 0x7f.1 to dotted quads; IPv6 keeps its brackets).
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new BlockedUrlError("URL has no host");
  if (ipaddr.isValid(host) && !options.isAllowed(host)) {
    throw new BlockedUrlError("Address is not allowed");
  }
}

/** undici wraps connect errors in `TypeError: fetch failed`; find our own error inside. */
function findBlocked(error: unknown): BlockedUrlError | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [error];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (current instanceof BlockedUrlError) return current;
    const { cause, errors } = current as { cause?: unknown; errors?: unknown };
    stack.push(cause);
    if (Array.isArray(errors)) stack.push(...errors);
  }
  return null;
}

/** Bodies worth reading: text-ish types (HTML for parsing, JSON for oEmbed). */
function isReadableType(contentType: string | null): boolean {
  if (contentType === null) return true;
  return /^(text\/|application\/(xhtml\+xml|xml|json)|[\w.+-]+\/[\w.+-]*\+(json|xml))/i.test(
    contentType.trim(),
  );
}

async function readBody(
  response: Awaited<ReturnType<typeof undiciFetch>>,
  maxBytes: number,
  stopAtHead: boolean,
): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const room = maxBytes - received;
      const chunk = value.byteLength > room ? value.subarray(0, room) : value;
      received += chunk.byteLength;
      const previousLength = text.length;
      text += decoder.decode(chunk, { stream: true });
      if (chunk.byteLength < value.byteLength) break; // cap reached
      // Re-scan a few characters back in case "</head>" straddles two chunks.
      if (stopAtHead && /<\/head\s*>/i.test(text.slice(Math.max(0, previousLength - 16)))) break;
    }
    return text + decoder.decode();
  } finally {
    // Stop the download without waiting on a server that may never finish.
    void reader.cancel().catch(() => undefined);
  }
}

/**
 * GET `url` without ever connecting to a non-public address. Throws BlockedUrlError when the URL
 * or a redirect target is not allowed, UnreachableError for everything else that goes wrong.
 */
export async function fetchSafe(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const {
    maxBytes = 1_000_000,
    timeoutMs = 5000,
    maxRedirects = 3,
    accept = DEFAULT_ACCEPT,
    lookup = dns.lookup,
    isAllowed = isPublicAddress,
    allowedPorts = [80, 443],
  } = options;

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new BlockedUrlError("Invalid URL");
  }
  assertAllowedTarget(current, { isAllowed, allowedPorts });

  const agent = new Agent({
    connect: { lookup: guardedLookup(lookup as unknown as RealLookup, isAllowed) },
  });
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    for (let redirects = 0; ; redirects++) {
      const response = await undiciFetch(current, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: accept,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const location = response.headers.get("location");
      if (REDIRECT_STATUSES.has(response.status) && location) {
        void response.body?.cancel().catch(() => undefined);
        if (redirects >= maxRedirects) throw new UnreachableError("Too many redirects");
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new UnreachableError("Bad redirect location");
        }
        assertAllowedTarget(next, { isAllowed, allowedPorts });
        current = next;
        continue;
      }

      if (response.status < 200 || response.status > 299) {
        void response.body?.cancel().catch(() => undefined);
        throw new UnreachableError(`Unexpected status ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      const body = isReadableType(contentType)
        ? await readBody(response, maxBytes, contentType === null || /html/i.test(contentType))
        : (void response.body?.cancel().catch(() => undefined), "");
      return { finalUrl: current.href, status: response.status, contentType, body };
    }
  } catch (error) {
    const blocked = findBlocked(error);
    if (blocked) throw blocked;
    if (error instanceof UnreachableError) throw error;
    throw new UnreachableError(signal.aborted ? "Timed out" : "Request failed");
  } finally {
    void agent.destroy().catch(() => undefined);
  }
}
