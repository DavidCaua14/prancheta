import type { Metadata } from "next";
import { GameShell } from "@/components/game/GameShell";
import { ShopHub } from "@/components/shop/ShopHub";

export const metadata: Metadata = { title: "Loja — Prancheta", robots: { index: false } };

export default function LojaPage() {
  return (
    <GameShell bare>
      <ShopHub />
    </GameShell>
  );
}
