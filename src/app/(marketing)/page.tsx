import type { Metadata } from "next";
import { Footer } from "@/components/marketing/footer";
import { Hero, HeroBackdrop, HowItWorks, SiteHeader } from "@/components/marketing/hero";
import { ClosingCta, Faq, Features, GuestMode } from "@/components/marketing/sections";

const title = "Things — save anything for later";
const description =
  "Drop in links, files and notes. Things sorts them by format and keeps them easy to find again.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", siteName: "Things" },
};

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
