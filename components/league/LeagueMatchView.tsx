"use client";

import { useEffect, useMemo, useState } from "react";
import { LiveMatch } from "@/components/match/LiveMatch";
import { matchAt, refreshChanges, sendChange } from "@/lib/league/data";
import { divisionInfo } from "@/lib/league/divisions";
import { useLeague } from "@/lib/league/useLeague";

/** Jogo da liga: lê a rodada/jogo da URL e usa a tela de partida ao vivo. */
export function LeagueMatchView() {
  const { club, data, setData } = useLeague({ autoJoin: false });
  const [ref, setRef] = useState<{ r: number; i: number } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o jogo pedido na URL uma vez
    setRef({ r: Number(p.get("r")) || 1, i: Number(p.get("i")) || 0 });
  }, []);

  const m = useMemo(() => {
    if (!data || !ref) return null;
    if (ref.r < 1 || ref.r > data.fixtures.length || !data.fixtures[ref.r - 1][ref.i]) return null;
    return matchAt(data, ref.r, ref.i);
  }, [data, ref]);

  if (!club || !data || !m) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <LiveMatch
      clubId={club.id}
      m={m}
      changes={data.changes}
      title={`${divisionInfo(data.league.division).name} · Rodada ${m.round}`}
      backHref="/liga?aba=rodadas"
      onSend={async (tick, list) => {
        const ok = await sendChange(data, m.round, club.id, tick, list);
        if (ok) setData(await refreshChanges(data, m.round));
        return ok;
      }}
    />
  );
}
