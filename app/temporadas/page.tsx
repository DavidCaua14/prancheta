import type { Metadata } from "next";
import { TpLanding } from "@/components/tp/TpLanding";

export const metadata: Metadata = {
  title: "Prancheta Temporadas — modo carreira grátis",
  description: "Comece na Série D com um clube real e leve seu time ao topo. Modo carreira gratuito do Prancheta, com escudos reais e o mesmo motor de partidas do jogo online.",
};

export default function TemporadasPage() {
  return <TpLanding />;
}
