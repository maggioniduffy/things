import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Inter_Tight } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Grain } from "@/components/brand";
import { I18nProvider } from "@/i18n/client";
import { SITE_URL } from "@/i18n/config";
import { getLocale, getT } from "@/i18n/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

/** Origin of this request, so previews and the two domains each point at themselves. */
async function requestOrigin(fallback: string) {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return fallback;
  const proto = list.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return fallback;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getT()]);
  const { title, description, siteName, ogAlt } = t.meta;
  const images = [{ url: `/brand/og-${locale}.png`, width: 1200, height: 630, alt: ogAlt }];
  return {
    metadataBase: new URL(await requestOrigin(SITE_URL[locale])),
    title,
    description,
    appleWebApp: { capable: true, title: siteName, statusBarStyle: "default" },
    alternates: { languages: { en: SITE_URL.en, es: SITE_URL.es } },
    openGraph: { title, description, siteName, type: "website", locale, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${interTight.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          <TooltipProvider>{children}</TooltipProvider>
        </I18nProvider>
        <Toaster />
        <Grain />
        {/* /_vercel/insights only exists on Vercel; elsewhere the script 404s into the console. */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
