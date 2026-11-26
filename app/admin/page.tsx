import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { GameShell } from "@/components/game/GameShell";

export const metadata: Metadata = { title: "Admin — Prancheta", robots: { index: false } };

export default function AdminPage() {
  return (
    <GameShell bare>
      <AdminPanel />
    </GameShell>
  );
}
