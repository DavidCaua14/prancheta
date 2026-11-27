import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { TpGame } from "@/components/tp/TpGame";

export const metadata: Metadata = { title: "Carreira — Prancheta Temporadas", robots: { index: false } };

export default function TpJogoPage() {
  return (
    <GameShell bare>
      <TpGame />
    </GameShell>
  );
}
