import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { FriendlyHub } from "@/components/friendly/FriendlyHub";

export const metadata: Metadata = { title: "Amistosos — Prancheta", robots: { index: false } };

export default function AmistososPage() {
  return (
    <GameShell bare>
      <FriendlyHub />
    </GameShell>
  );
}
