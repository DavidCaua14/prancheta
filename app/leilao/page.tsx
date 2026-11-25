import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { AuctionHouse } from "@/components/auction/AuctionHouse";

export const metadata: Metadata = { title: "Leilão — Prancheta", robots: { index: false } };

export default function LeilaoPage() {
  return (
    <GameShell bare>
      <AuctionHouse />
    </GameShell>
  );
}
