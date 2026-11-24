import type { Metadata } from "next";
import { Banner } from "@/components/auth/Banner";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { GameShell } from "@/components/game/GameShell";
import { MascotImage } from "@/components/game/Mascot";

export const metadata: Metadata = {
  title: "Entrar — Prancheta",
  description: "Entre com sua conta Google para fundar seu clube no Prancheta.",
};

export default function EntrarPage() {
  return (
    <GameShell>
      <LoginScreen mascot={<MascotImage className="h-full w-full" />} banner={<Banner name="banner-login" />} />
    </GameShell>
  );
}
