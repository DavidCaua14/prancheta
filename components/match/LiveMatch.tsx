"use client";

import { serverNow } from "@/lib/time";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { MatchBoard } from "@/components/match/MatchBoard";
import { buildPlan, scoreAtTime, visibleEvents } from "@/lib/sim/board";
import { CameraButton, Feed, Scoreboard, type FeedTeam, StatsPanel, liveStats, tickClock } from "@/components/match/parts";
import { Icon } from "@/components/ui/Icon";
import { fitLevel, FORMATIONS } from "@/lib/tactics/formations";
import { POSTURES } from "@/lib/tactics/lineup";
import { TACTIC_GROUPS, TACTIC_LETTERS, tacticAt, type TacticLetter } from "@/lib/tactics/live";
import { TICK_SECONDS, fmtCountdown, fmtKickoff, matchDone, type ChangeRow, type LeagueMatch } from "@/lib/league/data";
import { useNow } from "@/lib/league/useLeague";
import { useCamera } from "@/lib/sim/useCamera";
import { sendMessage, type SendResult } from "@/lib/live-changes";

/** Folga entre pedir a mudança e ela valer (para chegar a todos os aparelhos). */
const CHANGE_DELAY_TICKS = 4;

/** Código da substituição: "xAB" (elenco até 36 cartas) ou "yAABB" (até 1.296). */
export function subCode(out: number, inn: number) {
  if (out < 36 && inn < 36) return `x${out.toString(36)}${inn.toString(36)}`;
  return `y${out.toString(36).padStart(2, "0")}${inn.toString(36).padStart(2, "0")}`;
}

export type LiveMatchProps = {
  clubId: string;
  m: LeagueMatch;
  /** mudanças ao vivo já gravadas para este jogo (todas as do clube na rodada) */
  changes: ChangeRow[];
  /** linha de cima: "Série D · Rodada 3" / "Copa da Várzea · Quartas" */
  title: string;
  backHref: string;
  /** envia as mudanças; o servidor escolhe o minuto (agora + 4) e devolve qual */
  onSend: (changes: string[]) => Promise<SendResult>;
  /** placar final diferente de "FIM" (ex.: pênaltis) */
  finalStatus?: string;
  /** painel extra depois do apito final (ex.: disputa de pênaltis) */
  after?: ReactNode;
};

/** Partida ao vivo (liga ou copa): placar, narração, estatísticas e mudanças do técnico. */
export function LiveMatch({ clubId, m, changes, title, backHref, onSend, finalStatus, after }: LiveMatchProps) {
  // 4× por segundo: a narração aparece junto com o lance no quadro
  const now = useNow(250);
  const [sheet, setSheet] = useState<null | "tatica" | "subs">(null);
  const [subOut, setSubOut] = useState<number | null>(null);
  // rascunho da tática: o técnico mexe em tudo e só envia ao salvar
  const [draft, setDraft] = useState<Record<TacticLetter, number> | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [camera, toggleCamera] = useCamera();

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // quadro animado: minuto contínuo da partida (6 s por minuto)
  const getTime = useCallback(() => (serverNow() - m.kickoff) / (TICK_SECONDS * 1000), [m.kickoff]);
  const homeSide = useMemo(() => ({ lineup: m.homeLineup, squad: m.home.squad, tag: m.home.tag }), [m.homeLineup, m.home.squad, m.home.tag]);
  const awaySide = useMemo(() => ({ lineup: m.awayLineup, squad: m.away.squad, tag: m.away.tag }), [m.awayLineup, m.away.squad, m.away.tag]);
  const plan = useMemo(() => buildPlan(m.result, homeSide, awaySide, m.kickoff), [m.result, homeSide, awaySide, m.kickoff]);

  const before = now < m.kickoff;
  const done = matchDone(m, now);
  const tick = before ? -1 : done ? m.result.length : Math.floor((now - m.kickoff) / (TICK_SECONDS * 1000));
  // narração e placar em sincronia com o quadro (minuto contínuo)
  const tNow = (now - m.kickoff) / (TICK_SECONDS * 1000);
  const visible = before ? [] : done ? m.result.events : visibleEvents(plan, m.result.events, tNow);
  const score: [number, number] = before ? [0, 0] : done ? m.result.score : scoreAtTime(plan, m.result.events, tNow);
  const mySide: 0 | 1 | null = m.home.clubId === clubId ? 0 : m.away.clubId === clubId ? 1 : null;
  const live = !before && !done;
  const stats = liveStats(visible);

  // meu time agora (para substituições)
  const me = mySide === null ? null : mySide === 0 ? { team: m.home, lineup: m.homeLineup } : { team: m.away, lineup: m.awayLineup };
  const field = me ? FORMATIONS[me.lineup.formation].slots.map((s, k) => ({ role: s.role, card: me.lineup.xi[k], out: false })) : [];
  const used = new Set<number>();
  let subsDone = 0;
  for (const e of visible) {
    if (e.team !== mySide) continue;
    if (e.type === "sub" && e.player !== undefined && e.other !== undefined) {
      const f = field.find((x) => x.card === e.other);
      if (f) f.card = e.player;
      used.add(e.player);
      subsDone++;
    }
    if (e.type === "red") {
      const f = field.find((x) => x.card === e.player);
      if (f) f.out = true;
    }
  }
  // tática: o que está valendo agora e o que vai valer (com as mudanças já salvas e agendadas)
  const nowT = me ? tacticAt(changes, m.round, clubId, me.lineup, tick) : null;
  const plannedT = me ? tacticAt(changes, m.round, clubId, me.lineup, Number.POSITIVE_INFINITY) : null;
  const pendingTicks = changes.filter((c) => c.round === m.round && c.club_id === clubId && c.tick > tick && TACTIC_LETTERS.includes(c.change[0] as TacticLetter)).map((c) => c.tick);
  const pendingAt = pendingTicks.length ? Math.max(...pendingTicks) : null;
  const posture = plannedT?.p ?? 2;
  const changedNames = (from: Record<TacticLetter, number>, to: Record<TacticLetter, number>) =>
    TACTIC_LETTERS.filter((l) => from[l] !== to[l]).map((l) => (l === "p" ? POSTURES[to.p].label : `${TACTIC_GROUPS[l].short} ${TACTIC_GROUPS[l].options[to[l]].label.toLowerCase()}`));
  const scheduled = nowT && plannedT && pendingAt !== null ? changedNames(nowT, plannedT) : [];
  const draftDiff = draft && plannedT ? TACTIC_LETTERS.filter((l) => draft[l] !== plannedT[l]) : [];
  // etiquetas do quadro: a postura que está valendo agora em cada time
  const labels = [m.homeLineup, m.awayLineup].map((l, i) => {
    const team = i === 0 ? m.home : m.away;
    const p = tacticAt(changes, m.round, team.clubId, l, Math.max(0, tick)).p;
    return `${team.tag} · ${FORMATIONS[l.formation].name} · ${POSTURES[p].label}`;
  }) as [string, string];
  const bench = me ? me.team.squad.map((_, k) => k).filter((k) => !me.lineup.xi.includes(k) && !used.has(k)) : [];
  const canAct = live && mySide !== null && tick < m.result.length - CHANGE_DELAY_TICKS - 1;

  function openTactics() {
    if (plannedT) setDraft({ ...plannedT });
    setSheet("tatica");
  }

  async function saveTactics() {
    if (!draft || !draftDiff.length) return setSheet(null);
    await act(draftDiff.map((l) => `${l}${draft[l]}`));
  }

  async function act(list: string[]) {
    setSending(true);
    const r = await onSend(list);
    setToast(sendMessage(r));
    setSending(false);
    // deu errado: a folha fica aberta com as escolhas, para tentar de novo
    if (!r.ok) return;
    setSheet(null);
    setSubOut(null);
  }

  const feedTeams: [FeedTeam, FeedTeam] = [
    { tag: m.home.tag, crest: m.home.crest },
    { tag: m.away.tag, crest: m.away.crest },
  ];
  const feed = [...visible].reverse();

  return (
    <div className="flex min-h-dvh flex-col">
      <Scoreboard
        home={m.home}
        away={m.away}
        score={score}
        status={before ? fmtKickoff(m.kickoff, false) : done ? finalStatus ?? "FIM" : tickClock(tick, m.result.secondHalfTick, m.result.length)}
        progress={before ? 0 : Math.max(0, tick) / m.result.length}
        left={
          <Link href={backHref} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 font-extrabold text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
        }
      />

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 px-3 pb-28 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-10">
        <section className="flex min-w-0 flex-col gap-4">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.15em] text-white/70">
            {title} · {fmtKickoff(m.kickoff)}
            {live && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-[var(--red)] px-1.5 py-0.5 align-middle text-white">
                <Icon name="dot" className="h-2.5 w-2.5" /> AO VIVO
              </span>
            )}
          </p>

          {before && (
            <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-5 text-center text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
              <span className="tag">Pré-jogo</span>
              <p className="t-heading mt-3 text-xl">
                {m.home.name} × {m.away.name}
              </p>
              <p className="mt-2 text-sm font-bold opacity-75">
                Começa em <span className="t-num text-[var(--hot)]">{fmtCountdown(m.kickoff - now)}</span>
              </p>
              <p className="mt-1 text-xs opacity-60">
                {FORMATIONS[m.homeLineup.formation].name} × {FORMATIONS[m.awayLineup.formation].name}
                {mySide !== null && " · a escalação salva até o apito é a que vai a campo"}
              </p>
              {mySide !== null && (
                <Link href="/escalacao" className="btn btn-green mt-4">
                  Ajustar escalação
                </Link>
              )}
            </div>
          )}

          {!before && (
            <div className="hidden justify-end lg:flex">
              <CameraButton on={camera} onClick={toggleCamera} wide />
            </div>
          )}
          {!before && camera && <MatchBoard plan={plan} getTime={getTime} labels={labels} />}
          {done && after}
          {!before && <Feed events={feed} teams={feedTeams} mine={mySide ?? undefined} />}
        </section>

        <aside className="flex flex-col gap-4">
          {!before && (
            <StatsPanel
              rows={[
                ["Posse de bola", done ? `${m.result.stats[0].possession}%` : "–", done ? `${m.result.stats[1].possession}%` : "–"],
                ["Finalizações", stats[0].shots, stats[1].shots],
                ["No gol", stats[0].onTarget, stats[1].onTarget],
                ["Escanteios", stats[0].corners, stats[1].corners],
                ["Amarelos", stats[0].yellows, stats[1].yellows],
                ["Vermelhos", stats[0].reds, stats[1].reds],
              ]}
            />
          )}
          {mySide !== null && live && (
            <div className="hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] lg:block">
              <p className="t-heading">Seu time</p>
              <p className="mt-1 text-sm text-white/70">
                {nowT ? POSTURES[nowT.p].label : ""} · Substituições: {subsDone}/5
              </p>
              {scheduled.length > 0 && (
                <p className="mt-2 flex gap-1.5 rounded-lg bg-[var(--sun)]/15 px-2 py-1.5 text-xs font-bold text-[var(--sun)]">
                  <Icon name="clock" className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    Salvo, vale aos {Math.min(90, pendingAt!)}&apos;: {scheduled.join(", ")}
                  </span>
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={!canAct || sending} onClick={openTactics} className="btn btn-paper btn-sm flex-1 disabled:opacity-50">
                  <Icon name="clipboard" className="h-4 w-4" />
                  Tática
                </button>
                <button type="button" disabled={!canAct || sending || subsDone >= 5} onClick={() => setSheet("subs")} className="btn btn-paper btn-sm flex-1 disabled:opacity-50">
                  <Icon name="swap" className="h-4 w-4" />
                  Substituir
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {!before && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5 lg:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            {mySide !== null && live ? (
              <>
                <button
                  type="button"
                  disabled={!canAct || sending}
                  onClick={openTactics}
                  aria-label={scheduled.length ? `Tática: ${POSTURES[posture].label}, vale aos ${Math.min(90, pendingAt!)} minutos` : `Tática: ${POSTURES[posture].label}`}
                  className={`btn min-w-0 flex-[2] !gap-1.5 !px-2 !text-sm disabled:opacity-50 ${scheduled.length ? "bg-[var(--sun)] text-[var(--ink)]" : "btn-paper"}`}
                >
                  <Icon name={scheduled.length ? "clock" : "clipboard"} className={`h-5 w-5 shrink-0 ${scheduled.length ? "max-[359px]:hidden" : ""}`} />
                  <span className="truncate max-[359px]:hidden">{POSTURES[posture].label}</span>
                  <span className="truncate min-[360px]:hidden">{posture === 4 ? "Pra frente" : POSTURES[posture].label}</span>
                  {scheduled.length > 0 && <span className="t-num shrink-0 rounded bg-[var(--ink)] px-1 text-[0.65rem] text-white">{Math.min(90, pendingAt!)}&apos;</span>}
                </button>
                <button type="button" disabled={!canAct || sending || subsDone >= 5} onClick={() => setSheet("subs")} aria-label={`Substituir (${subsDone} de 5)`} className="btn btn-paper min-w-0 flex-1 !px-2 disabled:opacity-50">
                  <Icon name="swap" className="h-5 w-5 shrink-0" />
                  <span className="hidden truncate min-[440px]:inline">Substituir</span>
                  <span className="t-num shrink-0 rounded bg-[var(--ink)] px-1 text-[0.65rem] text-white">{subsDone}/5</span>
                </button>
              </>
            ) : (
              <span className="flex min-w-0 flex-1 items-center text-sm font-bold text-white/70">{done ? "Partida encerrada" : "Assistindo ao vivo"}</span>
            )}
            <CameraButton on={camera} onClick={toggleCamera} />
          </div>
        </div>
      )}

      {sheet && me && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(27,16,56,0.7)] sm:items-center" onClick={() => setSheet(null)}>
          <div className="anim-pop max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white sm:rounded-[24px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p className="text-xs font-bold text-white/60">A mudança vale cerca de {CHANGE_DELAY_TICKS} minutos de jogo depois (para chegar a todos).</p>
            {sheet === "tatica" && draft && nowT ? (
              <>
                <p className="t-heading mt-2 text-lg">Postura</p>
                <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Postura">
                  {POSTURES.map((p, k) => (
                    <button
                      key={p.label}
                      type="button"
                      role="radio"
                      aria-checked={k === draft.p}
                      disabled={sending}
                      onClick={() => setDraft({ ...draft, p: k })}
                      className={`rounded-xl border-[3px] border-[var(--ink)] px-3 py-2 text-left ${k === draft.p ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 hover:bg-white/20"}`}
                    >
                      <span className="flex items-center gap-2 font-extrabold">
                        {p.label}
                        {k === nowT.p && k !== draft.p && <span className="rounded bg-white/15 px-1 text-[0.6rem] uppercase">em campo</span>}
                      </span>
                      <span className="block text-xs opacity-75">{p.hint}</span>
                    </button>
                  ))}
                </div>
                {(["l", "w", "t"] as const).map((letter) => {
                  const g = TACTIC_GROUPS[letter];
                  return (
                    <div key={letter} className="mt-4">
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">{g.label}</p>
                      <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border-[3px] border-[var(--ink)] bg-black/25 p-1" role="radiogroup" aria-label={g.label}>
                        {g.options.map((o, k) => (
                          <button
                            key={o.label}
                            type="button"
                            role="radio"
                            aria-checked={k === draft[letter]}
                            disabled={sending}
                            onClick={() => setDraft({ ...draft, [letter]: k })}
                            className={`min-h-9 rounded-lg px-1 text-xs font-extrabold ${k === draft[letter] ? "bg-[var(--sun)] text-[var(--ink)]" : k === nowT[letter] ? "text-white ring-2 ring-inset ring-white/30" : "text-white/80 hover:bg-white/10"}`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="sticky -bottom-4 -mx-4 mt-4 flex gap-2 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-4 pb-4 pt-3">
                  <button type="button" onClick={() => setSheet(null)} className="btn btn-paper flex-1">
                    Cancelar
                  </button>
                  <button type="button" disabled={sending || !draftDiff.length} onClick={() => void saveTactics()} className="btn btn-green flex-[2] disabled:opacity-50">
                    <Icon name="check" className="h-5 w-5" />
                    {sending ? "Salvando..." : draftDiff.length ? "Salvar" : "Nada mudou"}
                    {draftDiff.length > 1 && <span className="t-num rounded bg-[var(--ink)] px-1.5 text-xs text-white" aria-label={`${draftDiff.length} mudanças`}>{draftDiff.length}</span>}
                  </button>
                </div>
              </>
            ) : sheet === "tatica" ? null : (
              <>
                <p className="t-heading mt-2 text-lg">Substituição ({subsDone}/5)</p>
                <p className="mt-1 text-xs text-white/70">{subOut === null ? "Quem sai?" : "Quem entra?"}</p>
                <ul className="mt-3 grid gap-1.5">
                  {(subOut === null
                    ? field.filter((f) => !f.out).map((f) => ({ card: f.card, role: f.role }))
                    : bench.map((b) => ({ card: b, role: field.find((f) => f.card === subOut)!.role }))
                  ).map(({ card, role }) => {
                    const c = me.team.squad[card];
                    const lvl = fitLevel(c, role);
                    return (
                      <li key={card}>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => (subOut === null ? setSubOut(card) : void act([subCode(subOut, card)]))}
                          className="flex w-full items-center gap-3 rounded-xl border-[3px] border-[var(--ink)] bg-white/10 px-3 py-2 text-left hover:bg-white/20"
                        >
                          <span className="t-num w-9 rounded bg-[var(--ink)] py-0.5 text-center text-[0.65rem]">{subOut === null ? role : c.position}</span>
                          <span className="flex-1 truncate font-bold">{c.name}</span>
                          {subOut !== null && lvl !== "ok" && (
                            <span className={`rounded px-1 text-[0.6rem] font-extrabold ${lvl === "bad" ? "bg-[var(--red)]" : "bg-[var(--sun)] text-[var(--ink)]"}`}>{lvl === "bad" ? "improvisado" : "adaptado"}</span>
                          )}
                          <span className="t-num">{c.overall}</span>
                        </button>
                      </li>
                    );
                  })}
                  {subOut !== null && bench.length === 0 && <li className="text-sm text-white/70">Sem reservas disponíveis.</li>}
                </ul>
              </>
            )}
            {sheet === "subs" && (
              <button
                type="button"
                onClick={() => {
                  setSheet(null);
                  setSubOut(null);
                }}
                className="btn btn-ghost mt-4 w-full"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="anim-pop fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-4 py-3 text-center text-sm font-extrabold text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
          {toast}
        </div>
      )}
    </div>
  );
}
