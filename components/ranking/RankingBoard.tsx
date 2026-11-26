"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { getMyClub, getSession } from "@/lib/club/api";
import { decodeCrest } from "@/lib/club/identity";
import { divisionInfo } from "@/lib/league/divisions";
import { CUP_MULT, DIVISION_MULT, loadRanking, type RankRow } from "@/lib/ranking";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] ${className}`}>{children}</section>;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");
const mult = (n: number) => `×${String(n).replace(".", ",")}`;

/** Degraus do pódio: 2º, 1º, 3º (alturas e cores). */
const PODIUM = [
  { place: 2, h: "h-20 sm:h-24", bg: "bg-[#cfd8e3]", medal: "bg-[#cfd8e3]" },
  { place: 1, h: "h-28 sm:h-32", bg: "bg-[var(--sun)]", medal: "bg-[var(--sun)]" },
  { place: 3, h: "h-14 sm:h-16", bg: "bg-[#e0a66b]", medal: "bg-[#e0a66b]" },
] as const;

export function RankingBoard() {
  const router = useRouter();
  const [week, setWeek] = useState(false);
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (w: boolean) => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      const c = await getMyClub(s);
      if (!c) return router.replace("/clube/novo");
      if (!c.squad) return router.replace("/peneira");
      try {
        setRows(await loadRanking(w));
        setError(false);
      } catch {
        setError(true);
      }
    },
    [router],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga assíncrona do ranking
    setRows(null);
    void load(week);
  }, [week, load]);

  const top = rows?.filter((r) => r.pos <= 50) ?? [];
  const me = rows?.find((r) => r.me) ?? null;
  const podium = PODIUM.map((p) => ({ ...p, row: top.find((r) => r.pos === p.place) ?? null }));
  const rest = top.filter((r) => r.pos > 3);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <ArtImg name="icon-ranking" className="h-11 w-11 object-contain" fallback={<Icon name="trophy" className="h-8 w-8 text-[var(--sun)]" />} />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Ranking</p>
            <p className="truncate text-xs font-bold text-white/60">Os melhores técnicos do Prancheta</p>
          </div>
          {me && (
            <span className="shrink-0 rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2.5 py-1 text-center text-[var(--ink)]">
              <span className="t-num block text-lg leading-none">{me.pos}º</span>
              <span className="block text-[0.55rem] font-extrabold uppercase">você</span>
            </span>
          )}
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-1 px-3 pb-2 sm:px-6" role="tablist">
          {(
            [
              [false, "Geral"],
              [true, "Semana"],
            ] as const
          ).map(([w, label]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={week === w}
              onClick={() => setWeek(w)}
              className={`h-9 rounded-xl text-sm font-extrabold ${week === w ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white/80"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 px-3 pb-24 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:pb-10">
        <div className="flex min-w-0 flex-col gap-4">
          {error && <p className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--red)] px-3 py-2 text-sm font-bold text-white">Não deu para carregar o ranking. Tente de novo.</p>}

          {/* pódio */}
          <Panel className="halftone !bg-[var(--hot)] !pb-0">
            <p className="text-center text-xs font-extrabold uppercase tracking-[0.2em] text-white/85">{week ? "Pódio da semana" : "Pódio geral"}</p>
            <div className="mt-3 grid grid-cols-3 items-end gap-2">
              {podium.map(({ place, h, bg, medal, row }) => (
                <div key={place} className="flex min-w-0 flex-col items-center">
                  {row ? (
                    <>
                      {place === 1 && <Icon name="trophy" className="mb-1 h-6 w-6 text-[var(--sun)] drop-shadow-[0_2px_0_var(--ink)]" />}
                      <CrestSvg crest={decodeCrest(row.crest)} tag={row.tag} className={`${place === 1 ? "h-16 w-14 sm:h-20 sm:w-[70px]" : "h-12 w-11 sm:h-16 sm:w-14"} drop-shadow-[0_3px_0_var(--ink)]`} />
                      <p className={`mt-1 max-w-full truncate text-center text-xs font-extrabold sm:text-sm ${row.me ? "text-[var(--sun)]" : ""}`}>{row.name}</p>
                      <p className="t-num text-xs text-white/85">{fmt(row.score)} pts</p>
                    </>
                  ) : (
                    <>
                      <span className="flex h-12 w-11 items-center justify-center rounded-xl border-[3px] border-dashed border-white/50 text-xl font-extrabold text-white/60">?</span>
                      <p className="mt-1 text-xs font-bold text-white/70">Vaga aberta</p>
                    </>
                  )}
                  <div className={`mt-1.5 flex w-full items-start justify-center rounded-t-xl border-[3px] border-b-0 border-[var(--ink)] pt-1.5 ${h} ${bg}`}>
                    <span className={`t-display flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[var(--ink)] text-lg text-[var(--ink)] [text-shadow:none] ${medal}`}>{place}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* tabela */}
          <Panel className="!p-0">
            {rows === null ? (
              <p className="p-4 text-sm text-white/70">Carregando...</p>
            ) : rest.length === 0 ? (
              <p className="p-4 text-sm text-white/70">{top.length ? "Só o pódio até aqui. Chame mais técnicos para a disputa!" : "Ninguém pontuou ainda."}</p>
            ) : (
              <ol aria-label="Classificação">
                {rest.map((r) => (
                  <Row key={r.club_id} r={r} />
                ))}
              </ol>
            )}
          </Panel>
          {me && me.pos > 50 && (
            <div className="sticky bottom-3 z-20">
              <ol aria-label="Sua posição" className="overflow-hidden rounded-[18px] border-[3px] border-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
                <Row r={me} />
              </ol>
            </div>
          )}
        </div>

        {/* como pontua */}
        <Panel>
          <p className="t-heading">Como pontua</p>
          <p className="mt-1 text-sm text-white/70">Só técnicos reais disputam. Vale o que já terminou — temporadas e copas encerradas.</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-2">
              <Icon name="star" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" />
              <span>
                <b>Temporada:</b> seus pontos na tabela × divisão. Título <b>+50</b> e acesso <b>+25</b> (também × divisão).
              </span>
            </li>
            <li className="flex gap-2">
              <Icon name="trophy" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" />
              <span>
                <b>Copas:</b> cada fase alcançada vale <b>10</b> × copa; campeão ganha <b>+40</b> × copa.
              </span>
            </li>
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/10 p-2">
              <p className="mb-1 font-extrabold uppercase text-white/60">Divisão</p>
              {DIVISION_MULT.map((m, d) => (
                <p key={d} className="flex justify-between">
                  <span className="truncate">{divisionInfo(d).short}</span>
                  <span className="t-num text-[var(--sun)]">{mult(m)}</span>
                </p>
              ))}
            </div>
            <div className="rounded-xl bg-white/10 p-2">
              <p className="mb-1 font-extrabold uppercase text-white/60">Copa</p>
              {["Várzea", "Nacional", "Supercopa", "Lendas"].map((n, k) => (
                <p key={n} className="flex justify-between">
                  <span className="truncate">{n}</span>
                  <span className="t-num text-[var(--sun)]">{mult(CUP_MULT[k])}</span>
                </p>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-white/60">A aba Semana conta só o que terminou nos últimos 7 dias: todo mundo tem chance de chegar ao topo. Empate: divisão atual, depois títulos.</p>
        </Panel>
      </div>
    </div>
  );
}

function Row({ r }: { r: RankRow }) {
  return (
    <li className={`flex items-center gap-2.5 border-b border-white/10 px-3 py-2.5 last:border-0 sm:px-4 ${r.me ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-[var(--night-2)]"}`}>
      <span className={`t-num w-8 shrink-0 text-center text-lg ${r.me ? "" : "text-white/70"}`}>{r.pos}º</span>
      <CrestSvg crest={decodeCrest(r.crest)} tag={r.tag} className="h-9 w-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold">
          {r.name}
          {r.me && <span className="ml-1.5 rounded bg-[var(--ink)] px-1 text-[0.6rem] uppercase text-white">você</span>}
        </span>
        <span className={`block truncate text-[0.7rem] font-bold ${r.me ? "opacity-75" : "text-white/60"}`}>
          {divisionInfo(r.division).short}
          {r.titles > 0 && ` · ${r.titles} ${r.titles === 1 ? "título" : "títulos"}`}
          {r.cup_titles > 0 && ` · ${r.cup_titles} ${r.cup_titles === 1 ? "copa" : "copas"}`}
        </span>
      </span>
      <span className="t-num shrink-0 text-right text-lg">
        {fmt(r.score)}
        <span className={`block text-[0.55rem] font-extrabold uppercase ${r.me ? "opacity-70" : "text-white/50"}`}>pts</span>
      </span>
    </li>
  );
}
