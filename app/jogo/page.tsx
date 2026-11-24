import type { Metadata } from "next";
import { Headquarters } from "@/components/club/Headquarters";
import { GameShell } from "@/components/game/GameShell";
import { MascotImage } from "@/components/game/Mascot";

export const metadata: Metadata = { title: "Sede do clube — Prancheta", robots: { index: false } };

export default function JogoPage() {
  return (
    <GameShell>
      <Headquarters mascot={<MascotImage className="h-full w-full" />} />
    </GameShell>
  );
}
