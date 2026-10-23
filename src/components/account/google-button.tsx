"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { AuroraButton } from "./aurora-button";

type GoogleButtonProps = {
  onClick: () => void;
  /** True while the browser is heading to Google: the aurora fill sweeps through the button. */
  pending: boolean;
  disabled?: boolean;
  children: ReactNode;
};

/** Secondary button with the Google "G" and the aurora loading fill. */
export function GoogleButton({ onClick, pending, disabled = false, children }: GoogleButtonProps) {
  const { login } = useT().auth;
  return (
    <AuroraButton
      variant="secondary"
      onClick={onClick}
      pending={pending}
      pendingLabel={login.connecting}
      disabled={disabled}
      icon={<Image src="/brand/google-g.svg" alt="" width={16} height={16} unoptimized />}
    >
      {children}
    </AuroraButton>
  );
}
