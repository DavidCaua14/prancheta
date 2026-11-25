import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { LeagueMatchView } from "@/components/league/LeagueMatchView";

export const metadata: Metadata = { title: "Jogo da liga — Prancheta", robots: { index: false } };

export default function LigaJogoPage() {
  return (
    <GameShell bare>
      <LeagueMatchView />
    </GameShell>
  );
}
