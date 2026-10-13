import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * True when `authorization` is exactly `Bearer ${secret}`. An empty secret never matches.
 * Both sides are hashed first so `timingSafeEqual` always gets equal-length buffers
 * and the comparison time does not depend on where the strings differ.
 */
export function isAuthorizedCronRequest(authorization: string | null, secret: string): boolean {
  if (!secret || !authorization) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
