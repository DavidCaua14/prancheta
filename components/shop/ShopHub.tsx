"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { COIN_PACKS, fmtPrice } from "@/lib/economy";

/** Loja de moedas (vitrine: o pagamento ainda não está ligado). */
export function ShopHub() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      const c = await getMyClub(s);
      if (!c) return router.replace("/clube/novo");
      setClub(c);
    })();
  }, [router]);

  const base = COIN_PACKS.find((p) => p.id === "punhado")!;
  const perReal = base.coins / base.price;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <ArtImg name="icon-loja" className="h-10 w-10 object-contain" fallback={<ArtImg name="icon-moeda" className="h-10 w-10 object-contain" fallback={<Icon name="star" className="h-8 w-8 text-[var(--sun)]" />} />} />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Loja</p>
            <p className="truncate text-xs font-bold text-white/60">Pacotes de moedas para o leilão</p>
          </div>
          {club && (
            <span className="flex shrink-0 items-center gap-1 rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2.5 py-1 text-[var(--ink)]">
              <ArtImg name="icon-moeda" className="h-5 w-5 object-contain" fallback={null} />
              <span className="t-num">{club.coins.toLocaleString("pt-BR")}</span>
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 pb-12 pt-4 sm:px-6">
        <section className="relative overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-gradient-to-br from-[var(--sun)] to-[var(--orange)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
          <ArtImg name="banner-loja" className="absolute inset-0 h-full w-full object-cover" fallback={<div className="halftone absolute inset-0 opacity-40" />} />
          <div className="relative bg-gradient-to-t from-[rgba(27,16,56,0.85)] via-[rgba(27,16,56,0.3)] to-transparent p-4 pt-20 text-white sm:pt-28">
            <h1 className="t-display text-3xl leading-none">Reforce o elenco</h1>
            <p className="mt-1 max-w-lg text-sm font-semibold text-white/90">Moedas para dar lances fortes no leilão e levar as cartas Épicas e Especiais.</p>
          </div>
        </section>

        <div className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sky)] px-3 py-2 text-sm font-bold text-[var(--ink)]">
          <Icon name="warning" className="mr-1 inline h-4 w-4" /> Pagamentos em breve: a loja está em desenvolvimento. Enquanto isso, ganhe moedas grátis nos{" "}
          <Link href="/eventos" className="underline">
            eventos da semana
          </Link>
          .
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COIN_PACKS.map((p) => {
            const extra = Math.round(((p.coins / p.price) / perReal - 1) * 100);
            return (
              <article key={p.id} className={`relative flex flex-col items-center rounded-[18px] border-[3px] border-[var(--ink)] p-3 text-center text-[var(--ink)] shadow-[0_4px_0_var(--ink)] ${p.once ? "bg-gradient-to-b from-[var(--sun)] to-[var(--paper)]" : "bg-[var(--paper)]"}`}>
                {p.tag && <span className="absolute -top-3 rounded-full border-2 border-[var(--ink)] bg-[var(--hot)] px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider text-white">{p.tag}</span>}
                <ArtImg
                  name={p.art}
                  className="mt-1 h-20 w-20 object-contain sm:h-24 sm:w-24"
                  fallback={
                    <span className="mt-1 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-[var(--ink)] bg-[var(--sun)] sm:h-24 sm:w-24">
                      <Icon name="star" className="h-10 w-10" />
                    </span>
                  }
                />
                <p className="mt-1 text-sm font-extrabold leading-tight">{p.name}</p>
                <p className="t-num mt-1 text-xl leading-none">{p.coins.toLocaleString("pt-BR")}</p>
                <p className="text-[0.65rem] font-extrabold uppercase tracking-wider opacity-60">moedas</p>
                <p className="mt-1 min-h-[1.1rem] text-[0.7rem] font-extrabold text-[var(--grass-2)]">
                  {p.bonus > 0 ? `+${p.bonus.toLocaleString("pt-BR")} de bônus${extra > 0 ? ` · ${extra}% a mais` : ""}` : " "}
                </p>
                <button type="button" disabled className="btn btn-green btn-sm mt-2 w-full disabled:opacity-60" title="Pagamento indisponível no ambiente de desenvolvimento">
                  {fmtPrice(p.price)}
                </button>
                <span className="mt-1 text-[0.62rem] font-bold opacity-60">Indisponível por enquanto</span>
              </article>
            );
          })}
        </div>
        <p className="text-center text-xs font-bold text-white/60">
          Moedas compradas servem só para o leilão; não mudam a força das cartas diretamente. Preços em reais, com impostos.
        </p>
      </div>
    </div>
  );
}
