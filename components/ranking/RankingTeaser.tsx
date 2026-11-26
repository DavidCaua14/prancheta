"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { loadRanking, type RankRow } from "@/lib/ranking";

/** Atalho na sede: sua posição no ranking e quem lidera. */
export function RankingTeaser() {
  const [rows, setRows] = useState<RankRow[] | null>(null);
  useEffect(() => {
    let stop = false;
    loadRanking(false, 1)
      .then((r) => !stop && setRows(r))
      .catch(() => !stop && setRows([]));
    return () => {
      stop = true;
    };
  }, []);
  const me = rows?.find((r) => r.me) ?? null;
  const leader = rows?.find((r) => r.pos === 1) ?? null;
  return (
    <Link
      href="/ranking"
      className="flex items-center gap-3 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)] shadow-[0_4px_0_var(--ink)] transition-transform active:translate-y-1 active:shadow-[0_1px_0_var(--ink)]"
    >
      <ArtImg name="icon-ranking" className="h-12 w-12 shrink-0 object-contain" fallback={<Icon name="trophy" className="h-10 w-10 shrink-0 text-[var(--orange)]" />} />
      <span className="min-w-0 flex-1">
        <span className="t-heading block">Ranking</span>
        <span className="block truncate text-xs font-bold opacity-70">
          {rows === null ? "Carregando..." : me ? `Você está em ${me.pos}º · ${me.score.toLocaleString("pt-BR")} pts` : "Dispute com outros técnicos"}
          {leader && !leader.me ? ` · líder: ${leader.name}` : ""}
        </span>
      </span>
      {me && <span className="t-num shrink-0 rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2 py-0.5 text-lg">{me.pos}º</span>}
      <Icon name="chevron-right" className="h-5 w-5 shrink-0" />
    </Link>
  );
}
