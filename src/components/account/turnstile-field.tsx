"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useCallback, useRef, type Ref } from "react";

/** Read at render time so tests can stub it; Next inlines the literal reference in the bundle. */
function getSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;
}

type TurnstileFieldProps = {
  /** Called with a fresh token, or null when it expires or the widget errors. */
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileInstance>;
};

/**
 * Cloudflare Turnstile widget. Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set
 * (it is unset locally and in e2e; captcha is enforced by the production dashboard).
 */
export function TurnstileField({ onToken, ref }: TurnstileFieldProps) {
  const siteKey = getSiteKey();
  if (!siteKey) return null;

  return (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      options={{ size: "flexible", appearance: "interaction-only" }}
      onSuccess={(token) => onToken(token)}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
    />
  );
}

/**
 * Token plumbing for forms that use `<TurnstileField {...field} />`.
 * `getToken()` resolves to undefined when captcha is off, the token when ready,
 * or null if the widget failed or timed out. Call `reset()` after every auth call:
 * a token is single-use.
 */
export function useTurnstile() {
  const instance = useRef<TurnstileInstance>(null);
  const token = useRef<string | null>(null);

  const onToken = useCallback((value: string | null) => {
    token.current = value;
  }, []);

  const getToken = useCallback(async (): Promise<string | undefined | null> => {
    if (!getSiteKey()) return undefined;
    if (token.current) return token.current;
    try {
      return (await instance.current?.getResponsePromise(15_000)) ?? null;
    } catch {
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    token.current = null;
    instance.current?.reset();
  }, []);

  return { field: { ref: instance, onToken }, getToken, reset };
}
