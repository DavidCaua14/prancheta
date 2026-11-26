import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { RankingBoard } from "@/components/ranking/RankingBoard";

export const metadata: Metadata = { title: "Ranking — Prancheta", robots: { index: false } };

export default function RankingPage() {
  return (
    <GameShell bare>
      <RankingBoard />
    </GameShell>
  );
}
