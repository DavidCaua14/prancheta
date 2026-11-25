import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { SimLab } from "@/components/lab/SimLab";

// Laboratório interno de simulação: sem link no jogo e fora dos buscadores.
export const metadata: Metadata = { title: "Laboratório — Prancheta", robots: { index: false, follow: false } };

export default function LabPage() {
  return (
    <GameShell bare>
      <SimLab />
    </GameShell>
  );
}
