import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { LeagueHub } from "@/components/league/LeagueHub";

export const metadata: Metadata = { title: "Liga — Prancheta", robots: { index: false } };

export default function LigaPage() {
  return (
    <GameShell bare>
      <LeagueHub />
    </GameShell>
  );
}
