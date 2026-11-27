"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";

/** Moedas caindo: posições fixas (sem sorteio na renderização). */
const COINS = [
  [5, 0.0, 1.2], [14, 0.4, 0.8], [23, 0.15, 1.4], [33, 0.7, 0.9], [44, 0.25, 1.3], [55, 0.55, 0.85],
  [64, 0.05, 1.2], [73, 0.45, 1.0], [82, 0.8, 1.3], [92, 0.3, 0.9], [9, 1.0, 1.0], [38, 1.1, 1.2],
  [60, 1.25, 0.9], [87, 1.15, 1.1], [27, 1.4, 0.8], [70, 1.5, 1.3],
] as const;

/**
 * Presente de boas-vindas: raios dourados, moedas caindo e o valor subindo
 * de 0 até o total. Fecha no botão (ou Esc).
 */
export function GiftReveal({ amount, clubName, onClose }: { amount: number; clubName: string; onClose: () => void }) {
  const [shown, setShown] = useState(0);
  // a sede redesenha a cada segundo (relógio): o contador não pode recomeçar a cada vez
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // contador: começa depois do saco de moedas aparecer, sobe em ~1,4 s (desacelerando no fim)
    let raf = 0;
    const start = performance.now() + 700;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1400));
      setShown(Math.round(amount * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [amount]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gift-title" className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[rgba(27,16,56,0.88)] p-4">
      <div aria-hidden className="win-rays pointer-events-none absolute left-1/2 top-[42%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {COINS.map(([x, delay, size], i) => (
          <span key={i} className="win-coin absolute top-0 block" style={{ left: `${x}%`, width: `${size * 2}rem`, height: `${size * 2}rem`, animationDelay: `${0.5 + delay}s` }}>
            <ArtImg name="icon-moeda" className="h-full w-full object-contain" fallback={<span className="block h-full w-full rounded-full border-[3px] border-[var(--ink)] bg-[var(--sun)]" />} />
          </span>
        ))}
      </div>

      <div className="no-scrollbar relative flex max-h-full w-full max-w-sm flex-col items-center overflow-y-auto overflow-x-hidden text-center text-white">
        <p className="win-up t-heading text-sm uppercase tracking-[0.2em] text-[var(--sun)]" style={{ animationDelay: "0.1s" }}>
          Presente de boas-vindas
        </p>
        <h2 id="gift-title" className="t-display mt-1 text-4xl text-white [text-shadow:0_4px_0_var(--ink)] sm:text-5xl [@media(max-height:700px)]:text-3xl">
          Bolada no caixa!
        </h2>

        <div className="win-card relative mt-5 flex h-36 w-36 items-center justify-center rounded-full border-[4px] border-[var(--ink)] bg-[var(--sun)] shadow-[0_6px_0_var(--ink)] [@media(max-height:700px)]:h-28 [@media(max-height:700px)]:w-28">
          <ArtImg name="icon-moeda" className="h-24 w-24 object-contain drop-shadow-[0_3px_0_var(--ink)] [@media(max-height:700px)]:h-16 [@media(max-height:700px)]:w-16" fallback={<Icon name="star" className="h-20 w-20 text-[var(--ink)]" />} />
        </div>

        <div className="win-up mt-6 w-full rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]" style={{ animationDelay: "0.45s" }}>
          <p className="text-xs font-extrabold uppercase tracking-wider opacity-60">Caiu na conta do {clubName}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1.5" aria-live="polite">
            <span className="t-num text-4xl text-[var(--grass-3)]">+{shown.toLocaleString("pt-BR")}</span>
            <span className="text-lg font-extrabold">moedas</span>
          </p>
          <p className="mt-1 text-sm font-semibold opacity-80">Dá para um lance forte numa carta boa do leilão. Monte o time dos sonhos!</p>
        </div>

        <div className="win-up mt-4 grid w-full grid-cols-2 gap-2" style={{ animationDelay: "1s" }}>
          <button type="button" onClick={onClose} className="btn btn-paper">
            Valeu!
          </button>
          <Link href="/leilao" className="btn btn-green">
            <Icon name="gavel" className="h-5 w-5" /> Ir ao leilão
          </Link>
        </div>
      </div>
    </div>
  );
}
