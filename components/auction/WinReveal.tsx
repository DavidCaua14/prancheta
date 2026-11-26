"use client";

import Link from "next/link";
import { useEffect } from "react";
import { GameCard } from "@/components/cards/GameCard";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { cardPotential, potentialLabel } from "@/lib/cards/evolution";
import type { BaseCard } from "@/lib/cards/generate";
import type { Kit } from "@/lib/club/identity";
import { CARD_TIERS } from "@/lib/game-config";

/** Moedas caindo: posições fixas (sem sorteio na renderização). */
const COINS = [
  [6, 0.0, 1.1], [18, 0.35, 0.8], [29, 0.1, 1.3], [41, 0.6, 0.9], [53, 0.2, 1.2], [64, 0.5, 0.85],
  [75, 0.05, 1.15], [86, 0.4, 0.95], [94, 0.7, 1.05], [12, 0.9, 0.9], [47, 1.0, 1.1], [70, 1.1, 0.8],
] as const;

/**
 * Tela de arremate: a carta vira no meio de raios dourados, o selo
 * "ARREMATADO!" carimba e aparece quanto custou. Uma por vez (fila no leilão).
 */
export function WinReveal({ card, amount, kit, tag, left, onClose }: { card: BaseCard; amount: number; kit: Kit; tag: string; left: number; onClose: () => void }) {
  const pot = cardPotential(card);
  const tier = CARD_TIERS[card.tier ?? "base"];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="win-title" className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[rgba(27,16,56,0.88)] p-4">
      {/* raios no fundo (fora da área que rola: não criam barra de rolagem) */}
      <div aria-hidden className="win-rays pointer-events-none absolute left-1/2 top-[42%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      {/* moedas caindo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {COINS.map(([x, delay, size], i) => (
          <span key={i} className="win-coin absolute top-0 block" style={{ left: `${x}%`, width: `${size * 2}rem`, height: `${size * 2}rem`, animationDelay: `${0.6 + delay}s` }}>
            <ArtImg name="icon-moeda" className="h-full w-full object-contain" fallback={<span className="block h-full w-full rounded-full border-[3px] border-[var(--ink)] bg-[var(--sun)]" />} />
          </span>
        ))}
      </div>

      <div className="no-scrollbar relative flex max-h-full w-full max-w-sm flex-col items-center overflow-y-auto overflow-x-hidden text-center text-white">
        <p className="win-up t-heading text-sm uppercase tracking-[0.2em] text-[var(--sun)]" style={{ animationDelay: "0.1s" }}>
          Leilão encerrado
        </p>
        <h2 id="win-title" className="t-display mt-1 text-4xl text-white [text-shadow:0_4px_0_var(--ink)] sm:text-5xl [@media(max-height:700px)]:text-4xl">
          É sua!
        </h2>

        <div className="relative mt-4 flex items-center justify-center">
          <div className="win-card relative">
            <GameCard card={card} kit={kit} tag={tag} className="!text-[clamp(9px,min(3.6vw,1.85dvh),14px)]" />
          </div>
          <span className="win-stamp absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <ArtImg
              name="selo-arrematado"
              className="h-16 w-auto object-contain drop-shadow-[0_4px_0_var(--ink)]"
              fallback={
                <span className="t-display block rounded-xl border-[3px] border-[var(--ink)] bg-[var(--red)] px-3 py-1 text-xl text-white shadow-[0_4px_0_var(--ink)] [text-shadow:0_2px_0_var(--ink)]">
                  ARREMATADO!
                </span>
              }
            />
          </span>
        </div>

        <div className="win-up mt-7 w-full rounded-[20px] [@media(max-height:700px)]:mt-5 [@media(max-height:700px)]:p-2.5 border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
          <p className="text-xs font-extrabold uppercase tracking-wider opacity-60">Você pagou</p>
          <p className="mt-0.5 flex items-center justify-center gap-1.5">
            <ArtImg name="icon-moeda" className="h-7 w-7 object-contain" fallback={<span className="inline-block h-5 w-5 rounded-full border-2 border-[var(--ink)] bg-[var(--sun)]" />} />
            <span className="t-num text-3xl">{amount.toLocaleString("pt-BR")}</span>
          </p>
          <p className="mt-2 text-sm font-bold">
            {card.name} · {card.position} · {tier.label}
          </p>
          <p className="text-xs font-semibold opacity-75">
            Potencial {potentialLabel(pot.grade)}: chega ao nível {pot.maxLevel} e overall {pot.maxOverall}
          </p>
        </div>

        <div className="win-up mt-4 grid w-full grid-cols-2 gap-2" style={{ animationDelay: "1.15s" }}>
          <button type="button" onClick={onClose} className="btn btn-paper">
            {left > 0 ? `Próxima (${left})` : "Continuar"}
          </button>
          <Link href="/escalacao" className="btn btn-green">
            <Icon name="clipboard" className="h-5 w-5" /> Escalar
          </Link>
        </div>
      </div>
    </div>
  );
}
