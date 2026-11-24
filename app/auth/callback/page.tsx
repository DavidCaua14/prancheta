import type { Metadata } from "next";
import { AuthCallback } from "@/components/auth/AuthCallback";
import { GameShell } from "@/components/game/GameShell";

export const metadata: Metadata = { title: "Entrando — Prancheta", robots: { index: false } };

export default function CallbackPage() {
  return (
    <GameShell>
      <AuthCallback />
    </GameShell>
  );
}
