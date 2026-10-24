"use client";

import {
  CircleHelpIcon,
  LanguagesIcon,
  LogOutIcon,
  MailPlusIcon,
  SettingsIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";
import { useChooseLocale } from "@/components/i18n/language-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { useLocale, useT } from "@/i18n/client";
import { LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useSignOut } from "./use-sign-out";

/** A small colored square behind a menu icon, so each group reads at a glance. */
function Chip({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("rounded-control flex size-6 shrink-0 items-center justify-center", className)}
    >
      <Icon className="size-3.5" />
    </span>
  );
}

type SettingsMenuProps = {
  /** Signed-in email, or null for a guest. */
  email: string | null;
  onNavigate?: () => void;
};

/** The gear at the bottom of the sidebar: account, language, help and sign out in one menu. */
export function SettingsMenu({ email, onNavigate }: SettingsMenuProps) {
  const messages = useT();
  const t = messages.shell.sidebar;
  const language = messages.common.language;
  const current = useLocale();
  const choose = useChooseLocale();
  const { signOut, pending } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton variant="ghost" size="sm" label={t.settings} data-tour="settings">
          <SettingsIcon />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuGroup aria-label={t.account}>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Chip icon={UserRoundIcon} className="bg-aurora-blue/15 text-aurora-blue" />
            <p className="text-meta text-ink min-w-0 truncate" title={email ?? undefined}>
              {email ?? t.guest}
            </p>
          </div>
          {email === null ? (
            <DropdownMenuItem
              onSelect={() => {
                onNavigate?.();
                useUiStore.getState().setUpgradeOpen(true);
              }}
            >
              <Chip icon={MailPlusIcon} className="bg-aurora-olive/20 text-ink" />
              {messages.onboarding.addEmail}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Chip icon={LanguagesIcon} className="bg-aurora-violet/15 text-aurora-violet" />
          {language.label}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current} onValueChange={(value) => choose(value as Locale)}>
          {LOCALES.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {language[locale]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onNavigate?.();
            useUiStore.getState().setTourOpen(true);
          }}
        >
          <Chip icon={CircleHelpIcon} className="bg-aurora-pink/15 text-aurora-pink" />
          {messages.onboarding.showTour}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => void signOut()}>
          <Chip icon={LogOutIcon} className="bg-aurora-red/15 text-aurora-red" />
          {t.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
