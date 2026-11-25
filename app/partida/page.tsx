import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { MatchViewer } from "@/components/match/MatchViewer";

export const metadata: Metadata = { title: "Partida — Prancheta", robots: { index: false } };

export default function PartidaPage() {
  return (
    <GameShell bare>
      <MatchViewer />
    </GameShell>
  );
}
