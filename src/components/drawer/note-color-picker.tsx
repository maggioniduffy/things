"use client";

import { CheckIcon } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";
import { focusRing } from "@/components/ui/focus-ring";
import {
  DEFAULT_NOTE_STYLE,
  NOTE_COLORS,
  NOTE_COLOR_STYLES,
  isNoteColor,
  type NoteColor,
} from "@/lib/items/note-colors";
import { cn } from "@/lib/utils";

type Option = { color: NoteColor | null; label: string; swatchClassName: string; inverse: boolean };

const OPTIONS: Option[] = [
  {
    color: null,
    label: DEFAULT_NOTE_STYLE.label,
    swatchClassName: DEFAULT_NOTE_STYLE.swatchClassName,
    inverse: false,
  },
  ...NOTE_COLORS.map((color) => ({
    color,
    label: NOTE_COLOR_STYLES[color].label,
    swatchClassName: NOTE_COLOR_STYLES[color].swatchClassName,
    inverse: NOTE_COLOR_STYLES[color].inverse,
  })),
];

/**
 * Round swatches in a radiogroup: Default plus the eight note colors. Roving tabindex, arrow keys
 * move and select (wrapping), Home and End jump to the ends.
 */
export function NoteColorPicker({
  value,
  onChange,
}: {
  /** The stored color; null or an unknown value reads as Default. */
  value: string | null;
  onChange: (color: NoteColor | null) => void;
}) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = isNoteColor(value) ? value : null;
  const selected = OPTIONS.findIndex((option) => option.color === current);

  function onKeyDown(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = OPTIONS.length - 1;
    else return;
    event.preventDefault();
    next = (next + OPTIONS.length) % OPTIONS.length;
    refs.current[next]?.focus();
    onChange(OPTIONS[next]?.color ?? null);
  }

  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-meta text-ink-muted font-medium">
        Color
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {OPTIONS.map((option, index) => {
          const checked = index === selected;
          return (
            <button
              key={option.label}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.label}
              title={option.label}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(option.color)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "border-line ease-out-soft flex size-7 cursor-pointer items-center justify-center rounded-full border transition-shadow duration-(--duration-fast)",
                option.swatchClassName,
                option.inverse ? "text-ink-inverse" : "text-ink",
                checked && "ring-ink ring-offset-paper ring-2 ring-offset-2",
                focusRing,
              )}
            >
              {checked ? <CheckIcon aria-hidden="true" className="size-3.5" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
