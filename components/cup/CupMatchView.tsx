"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LiveMatch } from "@/components/match/LiveMatch";
import { Icon } from "@/components/ui/Icon";
import { cupConfig, cupMatch, refreshCupChanges, roundName, roundsOf, sendCupChange, slotsIn } from "@/lib/cup/data";
import { pairsKnown, useCup } from "@/lib/cup/useCup";
import { useNow } from "@/lib/league/useLeague";

/** Jogo de copa: lê fase/jogo da URL e usa a tela de partida ao vivo. */
export function CupMatchView() {
  const [kind, setKind] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a copa pedida na URL uma vez
    setKind(Number(new URLSearchParams(window.location.search).get("k")) || 0);
  }, []);
  return kind === null ? null : <CupMatch kind={kind} />;
}

function CupMatch({ kind }: { kind: number }) {
  const { club, data, setData } = useCup(kind);
  const now = useNow(1000);
  const [ref, setRef] = useState<{ r: number; i: number } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o jogo pedido na URL uma vez
    setRef({ r: Number(p.get("r")) || 1, i: Number(p.get("i")) || 0 });
  }, []);

  const known = !!(data && ref && now && ref.r >= 1 && ref.r <= roundsOf(data.cup.size) && pairsKnown(data, ref.r, now));
  const m = useMemo(() => {
    if (!data || !ref || !known) return null;
    if (ref.i < 0 || ref.i >= slotsIn(data, ref.r).length / 2) return null;
    return cupMatch(data, ref.r, ref.i);
  }, [data, ref, known]);

  if (!club || !data || !ref) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }
  // jogo começou, mas os dados ainda são de antes do apito: espera a releitura
  if (!m || (now >= m.kickoff && data.loadedAt < m.kickoff)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <p className="font-bold">{m ? "Carregando o jogo..." : "Esse confronto ainda não está definido."}</p>
        <Link href={`/copas?k=${kind}`} className="btn btn-paper btn-sm">
          Voltar para a copa
        </Link>
      </div>
    );
  }

  const total = roundsOf(data.cup.size);
  const so = m.shootout;
  return (
    <LiveMatch
      clubId={club.id}
      m={m}
      changes={data.changes}
      title={`${cupConfig(kind).name} · ${roundName(m.round, total)}`}
      backHref={`/copas?k=${kind}`}
      finalStatus={so ? `PÊN ${so.score[0]}-${so.score[1]}` : undefined}
      after={
        so && (
          <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-4 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
            <p className="t-heading text-center">
              Pênaltis: {m.home.tag} {so.score[0]} × {so.score[1]} {m.away.tag}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {([0, 1] as const).map((side) => (
                <ol key={side} className="space-y-1">
                  <li className="text-center text-xs font-extrabold uppercase tracking-wider opacity-60">{side === 0 ? m.home.name : m.away.name}</li>
                  {so.kicks
                    .filter((k) => k.side === side)
                    .map((k, n) => (
                      <li key={n} className="flex items-center gap-1.5">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-extrabold ${k.scored ? "bg-[var(--grass)]" : "bg-[var(--red)] text-white"}`}>
                          <Icon name={k.scored ? "check" : "close"} className="h-3 w-3" />
                        </span>
                        <span className="truncate">{(side === 0 ? m.home : m.away).squad[k.player]?.name}</span>
                      </li>
                    ))}
                </ol>
              ))}
            </div>
            <p className="mt-3 text-center text-sm font-extrabold">{(so.winner === 0 ? m.home : m.away).name} avança!</p>
          </div>
        )
      }
      onSend={async (tick, list) => {
        const ok = await sendCupChange(data, m.round, club.id, tick, list);
        if (ok) setData(await refreshCupChanges(data, m.round));
        return ok;
      }}
    />
  );
}
