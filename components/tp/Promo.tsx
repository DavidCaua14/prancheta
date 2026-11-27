"use client";
/* eslint-disable @next/next/no-img-element -- artes já otimizadas em WebP */

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ART } from "@/lib/art-manifest";

/**
 * Divulgação do Prancheta Online dentro do Temporadas (seção 4 de
 * docs/PRANCHETA_TEMPORADAS.md). Todo botão leva ao online com ref/slot para
 * medir de onde veio. Nada trava o jogo; tudo fecha na hora.
 */
export const ONLINE_URL = (slot: string) => `/?ref=tp&slot=${slot}`;

type Piece = { art: string; kicker: string; title: string; text: string; cta: string };

const SIDE: Piece[] = [
  { art: "promo-online-leilao", kicker: "Leilão", title: "Cartas raras a cada 2 horas", text: "No online, você monta o elenco dando lances contra outros técnicos.", cta: "Ver o leilão" },
  { art: "promo-online-copa", kicker: "Copa todo dia", title: "32 técnicos, uma noite", text: "Mata-mata diário com prêmio em moedas para o campeão.", cta: "Disputar a copa" },
  { art: "promo-online-ranking", kicker: "Ranking", title: "Seu nome no topo", text: "Cada vitória vale pontos no ranking dos técnicos reais.", cta: "Ver o ranking" },
  { art: "promo-online-amistoso", kicker: "Amistosos", title: "Desafie seus amigos", text: "Mande o link no grupo e decidam em campo quem manda.", cta: "Marcar amistoso" },
];

const CARDS: Record<string, Piece> = {
  "match-win": { art: "promo-online-vitoria", kicker: "Prancheta Online", title: "Venceu a CPU. E contra gente?", text: "No online, o rival é um técnico de verdade mexendo no time ao vivo.", cta: "Aceitar o desafio" },
  "match-loss": { art: "promo-online-derrota", kicker: "Prancheta Online", title: "Monte um time mais forte", text: "No online, cartas raras saem no leilão e o seu elenco evolui a cada jogo.", cta: "Conhecer o online" },
  inbox: { art: "promo-online-jornal", kicker: "Notícia", title: "Copa da Várzea online lotada hoje", text: "Técnicos reais disputam o mata-mata da noite. Ainda dá tempo de se inscrever.", cta: "Jogar agora" },
  loading: { art: "promo-online-dica-1", kicker: "Sabia que...", title: "No online, o adversário é uma pessoa", text: "Mesma conta, grátis: enfrente técnicos reais em ligas, copas e amistosos.", cta: "Ir ao online" },
};

export function PromoCard({ slot, className = "", compact = false }: { slot: keyof typeof CARDS | string; className?: string; compact?: boolean }) {
  const p = CARDS[slot] ?? CARDS.loading;
  const small = p.art.startsWith("promo-online-dica");
  return (
    <div className={`overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)] ${className}`}>
      <div className={small ? "flex items-center gap-3 p-3" : ""}>
        {ART[p.art] && <img src={ART[p.art]} alt="" className={small ? "h-16 w-16 shrink-0 object-contain" : compact ? "block max-h-36 w-full object-cover object-top" : "block w-full"} loading="lazy" />}
        <div className={small ? "min-w-0" : "p-3"}>
          <span className="tag !bg-[var(--hot)] !text-white">{p.kicker}</span>
          <p className="t-heading mt-1.5">{p.title}</p>
          <p className="text-sm font-semibold opacity-75">{p.text}</p>
          {!small && (
            <a href={ONLINE_URL(slot)} className="btn btn-sm mt-2 !bg-[var(--hot)] !text-white">
              {p.cta} <Icon name="arrow-right" className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
      {small && (
        <a href={ONLINE_URL(slot)} className="block border-t-[3px] border-[var(--ink)] bg-[var(--hot)] px-3 py-2 text-center text-sm font-extrabold text-white">
          {p.cta}
        </a>
      )}
    </div>
  );
}

/** Cartão grande da sede (home-hero): recolhe para uma faixa, que volta a abrir depois de 7 dias. */
export function PromoHero() {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try {
      const at = Number(localStorage.getItem("prancheta:tp:promo-hero") ?? 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência salva no aparelho
      setFolded(Date.now() - at < 7 * 86400_000);
    } catch {}
  }, []);
  const fold = (v: boolean) => {
    setFolded(v);
    try {
      localStorage.setItem("prancheta:tp:promo-hero", v ? String(Date.now()) : "0");
    } catch {}
  };
  if (folded) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--hot)] px-3 py-2 text-white shadow-[0_4px_0_var(--ink)]">
        <Icon name="bolt" className="h-5 w-5 shrink-0" />
        <a href={ONLINE_URL("home-hero")} className="min-w-0 flex-1 truncate text-sm font-extrabold">
          Prancheta Online: jogue contra técnicos de verdade
        </a>
        <button type="button" onClick={() => fold(false)} className="text-xs font-extrabold underline">
          abrir
        </button>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
      {ART["promo-online-hero"] && <img src={ART["promo-online-hero"]} alt="" className="block min-h-[190px] w-full object-cover object-right" />}
      <div className="absolute inset-y-0 left-0 flex w-[62%] flex-col justify-center bg-gradient-to-r from-[rgba(27,16,56,0.92)] via-[rgba(27,16,56,0.75)] to-transparent p-4 text-white sm:w-[48%]">
        <span className="tag w-fit !bg-[var(--hot)] !text-white">Prancheta Online</span>
        <p className="t-display mt-2 text-xl leading-tight sm:text-3xl">Seu time contra técnicos de verdade</p>
        <a href={ONLINE_URL("home-hero")} className="btn btn-green btn-sm mt-3 w-fit">
          Jogar online <Icon name="arrow-right" className="h-4 w-4" />
        </a>
      </div>
      <button type="button" onClick={() => fold(true)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[var(--ink)] bg-white/90 text-[var(--ink)]" aria-label="Recolher">
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Coluna lateral: uma novidade do online por vez (gira a cada abertura). */
export function PromoSide() {
  const [i, setI] = useState(0);
  useEffect(() => {
    try {
      const n = (Number(localStorage.getItem("prancheta:tp:promo-side") ?? -1) + 1) % SIDE.length;
      localStorage.setItem("prancheta:tp:promo-side", String(n));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- gira a peça a cada abertura
      setI(n);
    } catch {}
  }, []);
  const p = SIDE[i];
  return (
    <div className="overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
      {ART[p.art] && <img src={ART[p.art]} alt="" className="block aspect-[4/3] w-full object-cover" loading="lazy" />}
      <div className="p-3">
        <span className="tag !bg-[var(--hot)] !text-white">{p.kicker}</span>
        <p className="t-heading mt-1.5">{p.title}</p>
        <p className="text-sm font-semibold opacity-75">{p.text}</p>
        <a href={ONLINE_URL("home-side")} className="btn btn-sm mt-2 !bg-[var(--hot)] !text-white">
          {p.cta}
        </a>
      </div>
    </div>
  );
}

/** Faixa fina (mercado). */
export function PromoStrip({ slot }: { slot: string }) {
  return (
    <a href={ONLINE_URL(slot)} className="relative block overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
      {ART["promo-online-mercado"] && <img src={ART["promo-online-mercado"]} alt="" className="block min-h-[96px] w-full object-cover object-right" loading="lazy" />}
      <span className="absolute inset-y-0 left-0 flex w-[60%] flex-col justify-center bg-gradient-to-r from-[rgba(27,16,56,0.9)] to-transparent p-3 text-white">
        <span className="text-[0.65rem] font-extrabold uppercase tracking-wider text-[var(--sun)]">Prancheta Online</span>
        <span className="t-heading text-sm leading-tight sm:text-lg">Cartas raras no leilão a cada 2 horas</span>
      </span>
    </a>
  );
}
