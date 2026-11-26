import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { FriendlyMatchView } from "@/components/friendly/FriendlyMatchView";

export const metadata: Metadata = { title: "Amistoso — Prancheta", robots: { index: false } };

export default function AmistosoJogoPage() {
  return (
    <GameShell bare>
      <FriendlyMatchView />
    </GameShell>
  );
}
