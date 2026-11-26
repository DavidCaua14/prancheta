"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { loadMatchPoints, loadRankClimb, matchRankPoints, type MatchPointsRow, type RankClimb as Climb } from "@/lib/ranking";
import { RankClimb } from "./RankClimb";
import { askScore } from "@/lib/score-client";
import { MATCH_SETTLE_MS } from "@/lib/scoring";
import { serverNow } from "@/lib/time";

const mult = (n: number) => `×${String(n).replace(".", ",")}`;

/**
 * Fim de jogo (liga ou copa): quantos pontos o técnico ganhou no ranking e
 * a posição atual. O servidor confere o resultado ~10 min depois do apito
 * inicial; até lá, o cartão mostra "conferindo".
 */
export function RankingPointsCard({ clubId, kind, refId, round, kickoff, multLabel }: { clubId: string; kind: 0 | 1; refId: number; round: number; kickoff: number; multLabel: string }) {
  const [row, setRow] = useState<MatchPointsRow | null | undefined>(undefined);
  const [climb, setClimb] = useState<Climb | null>(null);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      // pede a pontuação (idempotente) e lê o resultado gravado; tenta algumas vezes
      for (let attempt = 0; attempt < 4 && !stop; attempt++) {
        await askScore(kind === 0 ? "liga" : "copa", refId, round);
        const r = await loadMatchPoints(clubId, kind, refId, round);
        if (r) {
          if (stop) return;
          setRow(r);
          const p = matchRankPoints(r);
          const c = await loadRankClimb(p.total, (r.kind === 0 && r.result === 2) || (r.kind === 1 && r.advanced));
          if (!stop) setClimb(c);
          return;
        }
        await new Promise((res) => window.setTimeout(res, 4_000));
      }
      if (!stop) setRow(null);
    };
    const wait = kickoff + MATCH_SETTLE_MS + 3_000 - serverNow();
    const id = window.setTimeout(() => void run(), Math.max(0, wait));
    return () => {
      stop = true;
      window.clearTimeout(id);
    };
  }, [clubId, kind, refId, round, kickoff]);

  const pts = row ? matchRankPoints(row) : null;

  return (
    <div className="anim-pop rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)]">
      <div className="flex items-center gap-3">
        <ArtImg name="icon-ranking" className="h-12 w-12 shrink-0 object-contain" fallback={<Icon name="trophy" className="h-10 w-10 shrink-0 text-[var(--sun)]" />} />
        <div className="min-w-0 flex-1">
          <p className="t-heading">Ranking</p>
          {row === undefined ? (
            <p className="text-sm font-semibold text-white/70">Conferindo o resultado no servidor...</p>
          ) : !pts ? (
            <p className="text-sm font-semibold text-white/70">Os pontos deste jogo entram em instantes.</p>
          ) : pts.total > 0 ? (
            <p className="text-sm font-semibold text-white/80">{kind === 1 ? "Classificado! Pontos garantidos." : row!.result === 2 ? "Vitória! Pontos garantidos." : "Empate: também vale ponto."}</p>
          ) : (
            <p className="text-sm font-semibold text-white/80">{kind === 1 ? "Eliminado: sem pontos desta vez." : "Derrota: sem pontos desta vez. A próxima é sua!"}</p>
          )}
        </div>
        {pts && (
          <span className={`t-num shrink-0 rounded-xl border-[3px] border-[var(--ink)] px-2.5 py-1 text-2xl ${pts.total > 0 ? "bg-[var(--grass)] text-[var(--ink)]" : "bg-white/15 text-white"}`}>
            +{pts.total}
          </span>
        )}
      </div>

      {pts && pts.parts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
          {pts.parts.map((p) => (
            <span key={p.label} className="rounded-lg bg-white/10 px-2 py-1">
              {p.label} <span className="t-num text-[var(--grass)]">+{p.pts}</span>
            </span>
          ))}
          <span className="rounded-lg bg-[var(--sun)] px-2 py-1 text-[var(--ink)]">
            {multLabel} <span className="t-num">{mult(pts.mult)}</span>
          </span>
        </div>
      )}

      {climb ? (
        <RankClimb climb={climb} />
      ) : (
        row !== undefined && (
          <Link href="/ranking" className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">
            <span>Ver o ranking</span>
            <Icon name="chevron-right" className="h-4 w-4" />
          </Link>
        )
      )}
    </div>
  );
}
