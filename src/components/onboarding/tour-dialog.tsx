"use client";

import {
  ClipboardPasteIcon,
  FoldersIcon,
  MailIcon,
  type LucideIcon,
  SearchIcon,
  SettingsIcon,
  ShapesIcon,
  SparklesIcon,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

type StepKey = "welcome" | "capture" | "organize" | "find" | "canvas" | "settings" | "keep";

const STEPS: { key: StepKey; icon: LucideIcon; target?: string; guestOnly?: boolean }[] = [
  { key: "welcome", icon: SparklesIcon },
  { key: "capture", icon: ClipboardPasteIcon, target: "add" },
  { key: "organize", icon: FoldersIcon, target: "collections" },
  { key: "find", icon: SearchIcon, target: "search" },
  { key: "canvas", icon: ShapesIcon, target: "view" },
  { key: "settings", icon: SettingsIcon, target: "settings" },
  { key: "keep", icon: MailIcon, guestOnly: true },
];

const MARGIN = 16;
const GAP = 14;
const SPOTLIGHT_PADDING = 6;

type Box = { top: number; left: number; width: number; height: number };

/** The first matching `[data-tour]` element that is actually on screen (the sidebar renders twice). */
function findTarget(key: string | undefined): HTMLElement | null {
  if (!key) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

/** Puts the card beside the target: right, bottom, top, then left; null when nothing fits. */
function placeCard(target: Box, card: { width: number; height: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const alignedTop = clamp(target.top, MARGIN, vh - card.height - MARGIN);
  const alignedLeft = clamp(target.left, MARGIN, vw - card.width - MARGIN);
  const candidates = [
    { left: target.left + target.width + GAP, top: alignedTop },
    { left: alignedLeft, top: target.top + target.height + GAP },
    { left: alignedLeft, top: target.top - card.height - GAP },
    { left: target.left - card.width - GAP, top: alignedTop },
  ];
  return (
    candidates.find(
      (at) =>
        at.left >= MARGIN &&
        at.top >= MARGIN &&
        at.left + card.width <= vw - MARGIN &&
        at.top + card.height <= vh - MARGIN,
    ) ?? null
  );
}

type TourDialogProps = {
  open: boolean;
  /** Skip, Finish, Esc and an outside click all land here: the tour is done either way. */
  onClose: () => void;
  /** Adds the "Keep your things" step, whose button closes the tour and opens the upgrade dialog. */
  isGuest: boolean;
  onAddEmail: () => void;
};

/**
 * The first-visit tour: a spotlight on the part of the app each step talks about, with the step card
 * beside it. Blocking, but skippable (Esc and an outside click count as Skip).
 */
export function TourDialog({ open, onClose, isGuest, onAddEmail }: TourDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        {/* Mounted only while open, so a replay starts at step 1. */}
        <TourSteps onClose={onClose} isGuest={isGuest} onAddEmail={onAddEmail} />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function TourSteps({
  onClose,
  isGuest,
  onAddEmail,
}: Pick<TourDialogProps, "onClose" | "isGuest" | "onAddEmail">) {
  const t = useT().onboarding;
  const steps = STEPS.filter((step) => isGuest || !step.guestOnly);
  const [index, setIndex] = useState(0);
  const step = steps[index] ?? steps[0];
  const stepTarget = step?.target;

  const cardRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Box | null>(null);
  const [cardAt, setCardAt] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = findTarget(stepTarget);
      const card = cardRef.current?.getBoundingClientRect();
      if (!el || !card) {
        setSpot(null);
        setCardAt(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const box: Box = {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      };
      const at = placeCard(box, card);
      setSpot(at ? box : null);
      setCardAt(at);
    };
    findTarget(stepTarget)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [stepTarget, index]);

  if (!step) return null;
  const last = index === steps.length - 1;
  const Icon = step.icon;
  const copy = t.steps[step.key];

  return (
    <>
      {spot ? (
        <div
          data-slot="tour-spotlight"
          aria-hidden="true"
          style={spot}
          className={cn(
            "rounded-card ring-focus pointer-events-none fixed z-50 ring-2",
            "shadow-[0_0_0_9999px_color-mix(in_srgb,var(--color-ink)_45%,transparent)]",
            "motion-safe:transition-[top,left,width,height] motion-safe:duration-(--duration-base) motion-reduce:transition-none",
          )}
        />
      ) : (
        <div
          data-slot="tour-scrim"
          aria-hidden="true"
          className="bg-ink/45 motion-safe:animate-in motion-safe:fade-in-0 fixed inset-0 z-50"
        />
      )}

      <DialogPrimitive.Content
        ref={cardRef}
        data-slot="tour-card"
        style={cardAt ?? undefined}
        className={cn(
          "rounded-card border-line bg-note-white text-ink shadow-card fixed z-50 grid w-full max-w-[min(22rem,calc(100%-2rem))] gap-4 border p-5 outline-hidden",
          cardAt
            ? "motion-safe:transition-[top,left] motion-safe:duration-(--duration-base)"
            : "inset-0 m-auto h-fit",
        )}
      >
        {/* Keyed so each step fades in, unless the user prefers reduced motion. */}
        <div
          key={step.key}
          className="motion-safe:animate-in motion-safe:fade-in-0 grid items-start gap-1.5"
        >
          <span className="bg-paper text-ink mb-1 flex size-10 items-center justify-center rounded-full">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <DialogPrimitive.Title className="text-section text-ink font-medium">
            {copy.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-body text-ink-muted">
            {copy.body}
          </DialogPrimitive.Description>
        </div>

        <ol aria-label={t.progress(index + 1, steps.length)} className="flex items-center gap-1.5">
          {steps.map((other, dot) => (
            <li
              key={other.key}
              aria-current={dot === index ? "step" : undefined}
              className={`h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none ${
                dot === index ? "bg-ink w-5" : "bg-line w-1.5"
              }`}
            />
          ))}
        </ol>

        {last && isGuest ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onClose();
              onAddEmail();
            }}
          >
            {t.addEmail}
          </Button>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {last ? (
            <span />
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              {t.skip}
            </Button>
          )}
          <div className="flex gap-2">
            {index > 0 ? (
              <Button type="button" variant="secondary" onClick={() => setIndex(index - 1)}>
                {t.back}
              </Button>
            ) : null}
            {last ? (
              <Button type="button" onClick={onClose}>
                {t.finish}
              </Button>
            ) : (
              <Button type="button" onClick={() => setIndex(index + 1)}>
                {t.next}
              </Button>
            )}
          </div>
        </div>
      </DialogPrimitive.Content>
    </>
  );
}
