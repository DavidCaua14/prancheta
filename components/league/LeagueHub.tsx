"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { ArtImg } from "@/components/ui/ArtImg";
import {
  clockAt,
  fmtCountdown,
  fmtKickoff,
  matchAt,
  matchDone,
  standings,
  TICK_SECONDS,
  type LeagueData,
  type LeagueMatch,
} from "@/lib/league/data";
import { useLeague, useNow } from "@/lib/league/useLeague";
import { clockText } from "@/components/match/parts";

type Tab = "tabela" | "rodadas" | "jogos";

/** Placar de um jogo em um instante (ao vivo ou encerrado). */
export function scoreAt(m: LeagueMatch, now: number): { score: [number, number]; status: "antes" | "vivo" | "fim"; clock: string } {
  if (now < m.kickoff) return { score: [0, 0], status: "antes", clock: fmtKickoff(m.kickoff, false) };
  if (matchDone(m, now)) return { score: m.result.score, status: "fim", clock: "Fim" };
  const tick = Math.floor((now - m.kickoff) / (TICK_SECONDS * 1000));
  const seen = m.result.events.filter((e) => e.tick <= tick);
  const last = seen[seen.length - 1];
  return { score: last ? last.score : [0, 0], status: "vivo", clock: last ? clockText(last) : "0'" };
}

function MatchRow({ m, now, mySlot }: { m: LeagueMatch; now: number; mySlot: number | null }) {
  const s = scoreAt(m, now);
  const mine = m.home.slot === mySlot || m.away.slot === mySlot;
  return (
    <Link
      href={`/liga/jogo?r=${m.round}&i=${m.index}`}
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--ink)]/10 px-3 py-2.5 last:border-0 hover:bg-[var(--cream)] ${mine ? "bg-[var(--sun)]/30" : ""}`}
    >
      <span className="flex min-w-0 items-center justify-end gap-2 text-right">
        <span className="truncate text-sm font-bold">{m.home.name}</span>
        <CrestSvg crest={m.home.crest} tag={m.home.tag} className="h-8 w-7 shrink-0" />
      </span>
      <span className="flex w-16 flex-col items-center">
        <span className={`t-num rounded-md px-2 text-base leading-tight ${s.status === "vivo" ? "bg-[var(--red)] text-white" : s.status === "fim" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]/50"}`}>
          {s.status === "antes" ? "×" : `${s.score[0]}-${s.score[1]}`}
        </span>
        <span className={`t-num text-[0.62rem] ${s.status === "vivo" ? "text-[var(--red)]" : "opacity-50"}`}>{s.clock}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <CrestSvg crest={m.away.crest} tag={m.away.tag} className="h-8 w-7 shrink-0" />
        <span className="truncate text-sm font-bold">{m.away.name}</span>
      </span>
    </Link>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)] ${className}`}>
      {children}
    </section>
  );
}

function myFixtures(data: LeagueData, slot: number) {
  return data.fixtures.map((round, r) => {
    const i = round.findIndex((f) => f.home === slot || f.away === slot);
    return matchAt(data, r + 1, i);
  });
}

export function LeagueHub() {
  const { club, data, error, joining, reload } = useLeague();
  const now = useNow(1000);
  const [tab, setTab] = useState<Tab>("tabela");
  const [round, setRound] = useState<number | null>(null);

  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get("aba");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a aba pedida na URL uma vez
    if (aba === "jogos" || aba === "rodadas") setTab(aba);
  }, []);

  // a tabela só muda quando um jogo termina: recalcula por minuto, não por segundo
  const minute = Math.floor(now / 60_000);
  const table = useMemo(() => (data ? standings(data, minute * 60_000 + 59_999) : []), [data, minute]);

  if (!club || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-white">
        {error ? (
          <>
            <p className="font-bold">{error}</p>
            <button type="button" onClick={() => void reload()} className="btn btn-green">
              Tentar de novo
            </button>
          </>
        ) : (
          <>
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
            {joining && <p className="font-bold">Procurando uma vaga na Liga da Várzea...</p>}
          </>
        )}
      </div>
    );
  }

  const clock = clockAt(data, now);
  const mySlot = club.league_slot;
  const mine = mySlot !== null ? myFixtures(data, mySlot) : [];
  const shownRound = round ?? clock.live ?? clock.next ?? data.kickoffs.length;
  const liveMine = clock.live ? mine[clock.live - 1] : null;
  const nextMine = clock.next ? mine[clock.next - 1] : null;
  const myPos = table.findIndex((r) => r.slot === mySlot) + 1;
  const total = data.kickoffs.length;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 font-extrabold text-white" aria-label="Voltar">
            ←
          </Link>
          <ArtImg name="icon-liga" className="h-10 w-10 object-contain" fallback={<ArtImg name="trophy-copa-varzea" className="h-10 w-10 object-contain" fallback={null} />} />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Liga da Várzea</p>
            <p className="truncate text-xs font-bold text-white/60">
              Grupo #{data.league.id} · {clock.ended ? "Temporada encerrada" : `Rodada ${Math.min(total, clock.live ?? clock.next ?? total)} de ${total}`}
            </p>
          </div>
          {myPos > 0 && (
            <span className="flex shrink-0 flex-col items-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2.5 py-0.5 text-[var(--ink)]">
              <span className="text-[0.55rem] font-extrabold uppercase leading-none tracking-wider">Posição</span>
              <span className="t-num text-lg leading-none">{myPos}º</span>
            </span>
          )}
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-1 px-3 pb-2 sm:px-6" role="tablist">
          {(
            [
              ["tabela", "Tabela"],
              ["rodadas", "Rodadas"],
              ["jogos", "Meus jogos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-9 rounded-xl text-sm font-extrabold ${tab === id ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white/80"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 pb-12 pt-4 sm:px-6">
        {/* destaque: ao vivo / próximo jogo / fim da temporada */}
        {liveMine && !matchDone(liveMine, now) ? (
          <Link href={`/liga/jogo?r=${liveMine.round}&i=${liveMine.index}`} className="block rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--red)] p-4 text-white shadow-[0_5px_0_var(--ink)]">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em]">● Seu jogo está ao vivo</p>
            <p className="t-heading mt-1 text-xl">
              {liveMine.home.tag} {scoreAt(liveMine, now).score.join(" × ")} {liveMine.away.tag} · {scoreAt(liveMine, now).clock}
            </p>
            <p className="mt-1 text-sm font-bold underline">Assistir e mexer no time →</p>
          </Link>
        ) : clock.ended ? (
          <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--sun)] p-4 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
            <p className="t-heading text-xl">Temporada encerrada! Você terminou em {myPos}º.</p>
            <p className="mt-1 text-sm font-semibold">
              {myPos > 0 && myPos <= 2 ? "Campanha de acesso! " : ""}O acesso para a Série D chega numa próxima atualização. Enquanto isso, jogue a próxima temporada da Várzea.
            </p>
            <button type="button" onClick={() => void reload({ forceJoin: true })} disabled={joining} className="btn btn-green mt-3">
              {joining ? "Procurando liga..." : "Jogar a próxima temporada"}
            </button>
          </div>
        ) : nextMine ? (
          <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)]">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--sky)]">Seu próximo jogo · Rodada {nextMine.round}</p>
            <p className="t-heading mt-1 text-lg">
              {nextMine.home.name} × {nextMine.away.name}
            </p>
            <p className="mt-1 text-sm font-bold text-white/80">
              {fmtKickoff(nextMine.kickoff)} · começa em <span className="t-num text-[var(--sun)]">{fmtCountdown(nextMine.kickoff - now)}</span>
            </p>
            <Link href="/escalacao" className="btn btn-paper btn-sm mt-3">
              Ajustar escalação
            </Link>
          </div>
        ) : null}

        {tab === "tabela" && (
          <Panel>
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="bg-[var(--ink)] text-[0.68rem] uppercase tracking-wider text-white/80">
                  <th className="w-8 py-2 pl-2 text-left">#</th>
                  <th className="py-2 text-left">Clube</th>
                  <th className="w-9 py-2">P</th>
                  <th className="w-8 py-2">J</th>
                  <th className="hidden w-8 py-2 sm:table-cell">V</th>
                  <th className="hidden w-8 py-2 sm:table-cell">E</th>
                  <th className="hidden w-8 py-2 sm:table-cell">D</th>
                  <th className="hidden w-10 py-2 sm:table-cell">GP</th>
                  <th className="hidden w-10 py-2 sm:table-cell">GC</th>
                  <th className="w-10 py-2">SG</th>
                  <th className="hidden w-28 py-2 pr-2 md:table-cell">Últimos</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => {
                  const me = r.slot === mySlot;
                  return (
                    <tr key={r.slot} className={`border-b border-[var(--ink)]/10 last:border-0 ${me ? "bg-[var(--sun)]/40 font-extrabold" : ""}`}>
                      <td className="py-2 pl-2">
                        <span className={`t-num inline-flex h-6 w-6 items-center justify-center rounded-md text-xs ${i < 2 ? "bg-[var(--grass)] text-[var(--ink)]" : "bg-[var(--ink)]/10"}`}>{i + 1}</span>
                      </td>
                      <td className="py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <CrestSvg crest={r.team.crest} tag={r.team.tag} className="h-7 w-6 shrink-0" />
                          <span className="truncate font-bold">{r.team.name}</span>
                          {r.team.bot && <span className="shrink-0 rounded bg-[var(--ink)]/10 px-1 text-[0.55rem] font-extrabold uppercase">CPU</span>}
                        </span>
                      </td>
                      <td className="t-num py-2 text-center">{r.p}</td>
                      <td className="py-2 text-center">{r.j}</td>
                      <td className="hidden py-2 text-center sm:table-cell">{r.v}</td>
                      <td className="hidden py-2 text-center sm:table-cell">{r.e}</td>
                      <td className="hidden py-2 text-center sm:table-cell">{r.d}</td>
                      <td className="hidden py-2 text-center sm:table-cell">{r.gp}</td>
                      <td className="hidden py-2 text-center sm:table-cell">{r.gc}</td>
                      <td className="py-2 text-center">{r.gp - r.gc > 0 ? `+${r.gp - r.gc}` : r.gp - r.gc}</td>
                      <td className="hidden py-2 pr-2 md:table-cell">
                        <span className="flex justify-center gap-0.5">
                          {r.form.slice(-5).map((f, k) => (
                            <span key={k} className={`flex h-5 w-5 items-center justify-center rounded text-[0.6rem] font-extrabold ${f === "V" ? "bg-[var(--grass)]" : f === "E" ? "bg-[var(--ink)]/15" : "bg-[var(--red)] text-white"}`}>
                              {f}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="flex items-center gap-2 border-t border-[var(--ink)]/10 px-3 py-2 text-xs font-bold opacity-70">
              <span className="h-3 w-3 rounded bg-[var(--grass)]" /> Zona de acesso para a Série D · CPU = vaga ainda sem técnico (novos técnicos assumem essas vagas)
            </p>
          </Panel>
        )}

        {tab === "rodadas" && (
          <Panel>
            <div className="flex items-center justify-between gap-2 bg-[var(--ink)] px-3 py-2 text-white">
              <button type="button" disabled={shownRound <= 1} onClick={() => setRound(shownRound - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-extrabold disabled:opacity-30" aria-label="Rodada anterior">
                ◀
              </button>
              <div className="text-center">
                <p className="t-heading">Rodada {shownRound}</p>
                <p className="text-xs font-bold text-white/70">{fmtKickoff(data.kickoffs[shownRound - 1])}</p>
              </div>
              <button type="button" disabled={shownRound >= total} onClick={() => setRound(shownRound + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-extrabold disabled:opacity-30" aria-label="Próxima rodada">
                ▶
              </button>
            </div>
            {data.fixtures[shownRound - 1].map((_, i) => (
              <MatchRow key={i} m={matchAt(data, shownRound, i)} now={now} mySlot={mySlot} />
            ))}
          </Panel>
        )}

        {tab === "jogos" && (
          <Panel>
            {mine.map((m) => {
              const s = scoreAt(m, now);
              const home = m.home.slot === mySlot;
              const opp = home ? m.away : m.home;
              const [g, c] = home ? s.score : [s.score[1], s.score[0]];
              const res = s.status !== "fim" ? null : g > c ? "V" : g < c ? "D" : "E";
              return (
                <Link key={m.round} href={`/liga/jogo?r=${m.round}&i=${m.index}`} className="flex items-center gap-3 border-b border-[var(--ink)]/10 px-3 py-2.5 last:border-0 hover:bg-[var(--cream)]">
                  <span className="t-num w-8 text-xs opacity-60">R{m.round}</span>
                  <span className="w-24 shrink-0 text-xs font-bold opacity-70 sm:w-32">{fmtKickoff(m.kickoff)}</span>
                  <span className="rounded bg-[var(--ink)]/10 px-1 text-[0.6rem] font-extrabold">{home ? "CASA" : "FORA"}</span>
                  <CrestSvg crest={opp.crest} tag={opp.tag} className="h-7 w-6 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{opp.name}</span>
                  {s.status === "antes" ? (
                    <span className="text-xs opacity-50">–</span>
                  ) : (
                    <span className="t-num text-sm">
                      {g}-{c}
                    </span>
                  )}
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded text-[0.65rem] font-extrabold ${
                      s.status === "vivo" ? "bg-[var(--red)] text-white" : res === "V" ? "bg-[var(--grass)]" : res === "D" ? "bg-[var(--red)] text-white" : res === "E" ? "bg-[var(--ink)]/15" : ""
                    }`}
                  >
                    {s.status === "vivo" ? "●" : res ?? ""}
                  </span>
                </Link>
              );
            })}
          </Panel>
        )}

        <p className="text-center text-xs font-bold text-white/60">
          Rodadas às 8h, 10h, 12h, 14h, 16h, 18h, 20h e 22h (Brasília). Os jogos acontecem mesmo com você offline — vale a última escalação salva.
        </p>
      </div>
    </div>
  );
}
