import type { Metadata } from "next";
import { Banner } from "@/components/auth/Banner";
import { CreateClubWizard } from "@/components/club/CreateClubWizard";
import { GameShell } from "@/components/game/GameShell";
import { MascotImage } from "@/components/game/Mascot";

export const metadata: Metadata = { title: "Fundar clube — Prancheta", robots: { index: false } };

export default function NovoClubePage() {
  return (
    <GameShell>
      <CreateClubWizard mascot={<MascotImage className="h-full w-full" />} banner={<Banner name="banner-clube" />} />
    </GameShell>
  );
}
