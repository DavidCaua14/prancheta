import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import {
  Auction,
  CardsShowcase,
  ClubLife,
  Friends,
  HowItWorks,
  LeaguesAndCups,
  LiveMatch,
  Perks,
} from "@/components/landing/Sections";
import { Faq, FinalCta, SiteFooter } from "@/components/landing/Closing";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Perks />
        <LiveMatch />
        <HowItWorks />
        <CardsShowcase />
        <LeaguesAndCups />
        <Auction />
        <ClubLife />
        <Friends />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
