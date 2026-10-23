"use client";

import type { Ref } from "react";
import { Input } from "@/components/ui/input";
import { isValidOtp, sanitizeOtp } from "@/lib/auth";

type OtpCodeInputProps = {
  id: string;
  value: string;
  /** Receives the sanitized value (digits only, capped at six). */
  onValueChange: (value: string) => void;
  /** Called as soon as the value is a full six-digit code. */
  onComplete: (code: string) => void;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ref?: Ref<HTMLInputElement>;
};

/** The 6-digit code field shared by sign-in and the guest upgrade: digits only, submits when full. */
export function OtpCodeInput({
  id,
  value,
  onValueChange,
  onComplete,
  readOnly,
  invalid,
  describedBy,
  ref,
}: OtpCodeInputProps) {
  return (
    <Input
      ref={ref}
      id={id}
      name="code"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={12}
      placeholder="000000"
      value={value}
      onChange={(event) => {
        const next = sanitizeOtp(event.target.value);
        onValueChange(next);
        if (isValidOtp(next)) onComplete(next);
      }}
      readOnly={readOnly}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      className="h-11 text-center font-mono text-[length:var(--text-section)] tracking-[0.4em] sm:text-[length:var(--text-section)]"
    />
  );
}
