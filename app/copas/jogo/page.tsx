import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { CupMatchView } from "@/components/cup/CupMatchView";

export const metadata: Metadata = { title: "Jogo da copa — Prancheta", robots: { index: false } };

export default function CopaJogoPage() {
  return (
    <GameShell bare>
      <CupMatchView />
    </GameShell>
  );
}
