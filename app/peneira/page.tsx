import type { Metadata } from "next";
import { Tryout } from "@/components/cards/Tryout";
import { GameShell } from "@/components/game/GameShell";
import { MascotImage } from "@/components/game/Mascot";

export const metadata: Metadata = { title: "Peneira — Prancheta", robots: { index: false } };

export default function PeneiraPage() {
  return (
    <GameShell bare>
      <Tryout mascot={<MascotImage className="h-full w-full" />} />
    </GameShell>
  );
}
