"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { collectHomeIncome, homeIncomeOf, type HomeIncomeRow } from "@/lib/club/structure";
import { serverNow } from "@/lib/time";

/** O servidor paga a renda 10 min depois do apito inicial (jogo garantidamente encerrado). */
const PAY_AFTER_MS = 10 * 60_000 + 1_500;

/** Fim de jogo da liga em casa: quanto a estrutura do clube rendeu. */
export function HomeIncomeCard({ clubId, leagueId, round, kickoff }: { clubId: string; leagueId: number; round: number; kickoff: number }) {
  const [row, setRow] = useState<HomeIncomeRow | null | undefined>(undefined);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      await collectHomeIncome();
      const r = await homeIncomeOf(clubId, leagueId, round);
      if (!stop) setRow(r);
    };
    const wait = kickoff + PAY_AFTER_MS - serverNow();
    const id = window.setTimeout(() => void run(), Math.max(0, wait));
    return () => {
      stop = true;
      window.clearTimeout(id);
    };
  }, [clubId, leagueId, round, kickoff]);

  const coin = <ArtImg name="icon-moeda" className="h-5 w-5 object-contain" fallback={<span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--ink)] bg-[var(--sun)]" />} />;

  return (
    <div className="anim-pop rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-4 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
      <p className="t-heading flex items-center gap-2">
        <Icon name="home" className="h-5 w-5" /> Renda do jogo em casa
      </p>
      {row === undefined ? (
        <p className="mt-1 text-sm font-semibold opacity-70">Contando a bilheteria...</p>
      ) : !row || row.coins === 0 ? (
        <div className="mt-1 text-sm font-semibold">
          <p className="opacity-75">Seu clube ainda não tem estrutura para faturar com jogos em casa.</p>
          <Link href="/jogo?aba=clube" className="btn btn-green btn-sm mt-2">
            Investir no estádio
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 flex items-center gap-1.5">
            {coin}
            <span className="t-num text-3xl text-[var(--grass-2)]">+{row.coins.toLocaleString("pt-BR")}</span>
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center text-sm">
            {(
              [
                ["Bilheteria", row.stadium],
                ["Lanchonete", row.snack],
                ["Loja", row.shop],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-[var(--cream)] py-1">
                <dt className="text-[0.6rem] font-extrabold uppercase opacity-60">{k}</dt>
                <dd className="t-num">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
