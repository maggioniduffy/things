"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MonitorDownIcon, ShareIcon, SmartphoneIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus-ring";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type InstallPlatform = "android" | "ios" | "desktop";

/** Picks the tab to open first. iPadOS 13+ reports a Mac user agent, so touch points tell it apart. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** True when the page already runs as an installed app. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const noopSubscribe = () => () => {};
const ICONS: Record<InstallPlatform, LucideIcon> = {
  android: SmartphoneIcon,
  ios: ShareIcon,
  desktop: MonitorDownIcon,
};
const ORDER: InstallPlatform[] = ["android", "ios", "desktop"];

export function InstallPrompt() {
  const { install } = useT().marketing;
  // Server and first client render agree on "desktop"; the detected value follows after hydration.
  const detected = useSyncExternalStore<InstallPlatform>(
    noopSubscribe,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => "desktop",
  );
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const [chosen, setChosen] = useState<InstallPlatform | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const active = chosen ?? detected;

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferred) return;
    const event = deferred;
    setDeferred(null); // a prompt event can be used once
    await event.prompt();
  }

  const platform = install.platforms[active];
  return (
    <div className="mt-8 max-w-3xl">
      {standalone || installed ? (
        <p role="status" className="text-body text-ink-muted">
          {install.installedNote}
        </p>
      ) : (
        <>
          {deferred ? (
            <Button className="mb-6" onClick={promptInstall}>
              <MonitorDownIcon aria-hidden="true" />
              {install.installButton}
            </Button>
          ) : null}
          <div
            role="tablist"
            aria-label={install.tabsLabel}
            className="border-line bg-surface rounded-control inline-flex flex-wrap gap-1 border p-1"
          >
            {ORDER.map((key) => {
              const Icon = ICONS[key];
              const selected = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`install-tab-${key}`}
                  aria-selected={selected}
                  aria-controls="install-panel"
                  onClick={() => setChosen(key)}
                  className={cn(
                    "rounded-control text-body inline-flex items-center gap-2 px-3 py-1.5 font-medium transition-[color,background-color] duration-(--duration-fast)",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-ink-muted hover:text-ink",
                    focusRing,
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {install.platforms[key].tab}
                </button>
              );
            })}
          </div>
          <div
            role="tabpanel"
            id="install-panel"
            aria-labelledby={`install-tab-${active}`}
            className="border-line bg-surface rounded-card mt-4 border p-5"
          >
            <h3 className="text-card text-ink font-medium">{platform.title}</h3>
            <ol className="text-body text-ink-muted mt-3 list-decimal space-y-2 pl-5">
              {platform.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {"note" in platform ? (
              <p className="text-meta text-ink-subtle mt-4">{platform.note}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
