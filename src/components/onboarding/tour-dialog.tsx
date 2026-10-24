"use client";

import {
  ClipboardPasteIcon,
  FoldersIcon,
  MailIcon,
  type LucideIcon,
  SearchIcon,
  ShapesIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useT } from "@/i18n/client";

type StepKey = "welcome" | "capture" | "organize" | "find" | "canvas" | "keep";

const STEPS: { key: StepKey; icon: LucideIcon; guestOnly?: boolean }[] = [
  { key: "welcome", icon: SparklesIcon },
  { key: "capture", icon: ClipboardPasteIcon },
  { key: "organize", icon: FoldersIcon },
  { key: "find", icon: SearchIcon },
  { key: "canvas", icon: ShapesIcon },
  { key: "keep", icon: MailIcon, guestOnly: true },
];

type TourDialogProps = {
  open: boolean;
  /** Skip, Finish, Esc and an outside click all land here: the tour is done either way. */
  onClose: () => void;
  /** Adds the "Keep your things" step, whose button closes the tour and opens the upgrade dialog. */
  isGuest: boolean;
  onAddEmail: () => void;
};

/** The first-visit step modal. Blocking, but skippable (Esc and outside click count as Skip). */
export function TourDialog({ open, onClose, isGuest, onAddEmail }: TourDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <ResponsiveDialogContent showCloseButton={false}>
        {/* Mounted only while open, so a replay starts at step 1. */}
        <TourSteps onClose={onClose} isGuest={isGuest} onAddEmail={onAddEmail} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
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
  if (!step) return null;
  const last = index === steps.length - 1;
  const Icon = step.icon;
  const copy = t.steps[step.key];

  return (
    <>
      {/* Keyed so each step fades in, unless the user prefers reduced motion. */}
      <ResponsiveDialogHeader
        key={step.key}
        className="motion-safe:animate-in motion-safe:fade-in-0 items-start"
      >
        <span className="bg-paper text-ink mb-1 flex size-10 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <ResponsiveDialogTitle>{copy.title}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>{copy.body}</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

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

      <ResponsiveDialogFooter className="items-center sm:justify-between">
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
      </ResponsiveDialogFooter>
    </>
  );
}
