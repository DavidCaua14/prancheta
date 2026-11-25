import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { LineupEditor } from "@/components/lineup/LineupEditor";

export const metadata: Metadata = { title: "Escalação — Prancheta", robots: { index: false } };

export default function EscalacaoPage() {
  return (
    <GameShell bare>
      <LineupEditor />
    </GameShell>
  );
}
