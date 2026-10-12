"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Resolved value of a CSS custom property, read from <html> after hydration. */
export function TokenValue({ name }: { name: string }) {
  const value = useSyncExternalStore(
    subscribe,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => "",
  );
  return <span className="text-meta text-ink-subtle break-all">{value || " "}</span>;
}
