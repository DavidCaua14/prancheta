import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { CupHub } from "@/components/cup/CupHub";

export const metadata: Metadata = { title: "Copas — Prancheta", robots: { index: false } };

export default function CopasPage() {
  return (
    <GameShell bare>
      <CupHub />
    </GameShell>
  );
}
