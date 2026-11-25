import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { EventsHub } from "@/components/events/EventsHub";

export const metadata: Metadata = { title: "Eventos — Prancheta", robots: { index: false } };

export default function EventosPage() {
  return (
    <GameShell bare>
      <EventsHub />
    </GameShell>
  );
}
