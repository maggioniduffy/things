import type { Metadata } from "next";
import { Footer } from "@/components/marketing/footer";
import { Hero, HeroBackdrop, HowItWorks, SiteHeader } from "@/components/marketing/hero";

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
        <main>
          <Hero />
          <HowItWorks />
        </main>
      </div>
      <Footer />
    </div>
  );
}
