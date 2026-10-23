import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { safeNextPath } from "@/lib/supabase/proxy";
import { LoginPanel } from "./login-panel";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getT();
  return { title: meta.login.title, robots: { index: false } };
}

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    reason?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const callbackError =
    first(params.error) !== "callback"
      ? null
      : first(params.reason) === "account_exists"
        ? "account_exists"
        : "generic";

  return <LoginPanel next={next} callbackError={callbackError} />;
}
