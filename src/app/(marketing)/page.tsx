import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { Footer } from "@/components/marketing/footer";
import { Hero, HeroBackdrop, HowItWorks, SiteHeader } from "@/components/marketing/hero";
import { ClosingCta, Faq, Features, GuestMode } from "@/components/marketing/sections";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getT();
  const { title, description } = meta.landing;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: meta.siteName },
  };
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <HeroBackdrop />
        <SiteHeader />
        <main className="overflow-x-clip">
          <Hero />
          <HowItWorks />
          <Features />
          <GuestMode />
          <Faq />
          <ClosingCta />
        </main>
      </div>
      <Footer />
    </div>
  );
}
