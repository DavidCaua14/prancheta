import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import {
  Auction,
  CardsShowcase,
  Friends,
  HowItWorks,
  LeaguesAndCups,
  LiveMatch,
  Perks,
  Ticker,
} from "@/components/landing/Sections";
import { Faq, FinalCta, SiteFooter } from "@/components/landing/Closing";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Ticker />
        <Perks />
        <LiveMatch />
        <HowItWorks />
        <CardsShowcase />
        <LeaguesAndCups />
        <Auction />
        <Friends />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
