import type { Metadata } from "next";
import { ClubHome } from "@/components/club/ClubHome";
import { GameShell } from "@/components/game/GameShell";
import { MascotImage } from "@/components/game/Mascot";

export const metadata: Metadata = { title: "Prancheta — Meu clube", robots: { index: false } };

export default function JogoPage() {
  return (
    <GameShell bare>
      <ClubHome mascot={<MascotImage className="h-full w-full" />} />
    </GameShell>
  );
}
