"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Feed, Scoreboard, StatsPanel, clockText, liveStats } from "@/components/match/parts";
import { Icon } from "@/components/ui/Icon";
import { fitLevel, FORMATIONS } from "@/lib/tactics/formations";
import { POSTURES } from "@/lib/tactics/lineup";
import {
  TICK_SECONDS,
  fmtCountdown,
  fmtKickoff,
  matchAt,
  matchDone,
  refreshChanges,
  sendChange,
} from "@/lib/league/data";
import { useLeague, useNow } from "@/lib/league/useLeague";

/** Folga entre pedir a mudança e ela valer (para chegar a todos os aparelhos). */
const CHANGE_DELAY_TICKS = 4;

export function LeagueMatchView() {
  const { club, data, setData } = useLeague({ autoJoin: false });
  const now = useNow(1000);
  const [ref, setRef] = useState<{ r: number; i: number } | null>(null);
  const [sheet, setSheet] = useState<null | "tatica" | "subs">(null);
  const [subOut, setSubOut] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o jogo pedido na URL uma vez
    setRef({ r: Number(p.get("r")) || 1, i: Number(p.get("i")) || 0 });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

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

  const before = now < m.kickoff;
  const done = matchDone(m, now);
  const tick = before ? -1 : done ? m.result.length : Math.floor((now - m.kickoff) / (TICK_SECONDS * 1000));
  const visible = m.result.events.filter((e) => e.tick <= tick);
  const last = visible[visible.length - 1];
  const score: [number, number] = last ? last.score : [0, 0];
  const mySide: 0 | 1 | null = m.home.clubId === club.id ? 0 : m.away.clubId === club.id ? 1 : null;
  const live = !before && !done;
  const stats = liveStats(visible);

  // meu time agora (para substituições)
  const me = mySide === null ? null : mySide === 0 ? { team: m.home, lineup: m.homeLineup } : { team: m.away, lineup: m.awayLineup };
  const field = me ? FORMATIONS[me.lineup.formation].slots.map((s, k) => ({ role: s.role, card: me.lineup.xi[k], out: false })) : [];
  const used = new Set<number>();
  let subsDone = 0;
  let posture = me?.lineup.posture ?? 2;
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
  const pending = data.changes.filter((c) => c.round === m.round && c.club_id === club.id && c.tick > tick);
  for (const c of data.changes) if (c.round === m.round && c.club_id === club.id && c.tick <= tick && c.change[0] === "p") posture = Number(c.change[1]);
  const pendingPosture = pending.find((c) => c.change[0] === "p");
  const bench = me ? me.team.squad.map((_, k) => k).filter((k) => !me.lineup.xi.includes(k) && !used.has(k)) : [];
  const canAct = live && mySide !== null && tick < m.result.length - CHANGE_DELAY_TICKS - 1;

  async function act(change: string) {
    if (!data || !m || !club) return;
    setSending(true);
    const at = tick + CHANGE_DELAY_TICKS;
    const ok = await sendChange(data, m.round, club.id, at, change);
    if (ok) {
      const next = await refreshChanges(data, m.round);
      setData(next);
      setToast(`Ok! Vale a partir do minuto ${Math.min(90, at)}.`);
    } else {
      setToast("Não deu tempo: o lance já passou. Tente de novo.");
    }
    setSending(false);
    setSheet(null);
    setSubOut(null);
  }

  const tags: [string, string] = [m.home.tag, m.away.tag];
  const feed = [...visible].reverse().filter((e) => e.type !== "corner" || done);

  return (
    <div className="flex min-h-dvh flex-col">
      <Scoreboard
        home={m.home}
        away={m.away}
        score={score}
        status={before ? fmtKickoff(m.kickoff, false) : done ? "FIM" : last ? clockText(last) : "0'"}
        progress={before ? 0 : Math.max(0, tick) / m.result.length}
        left={
          <Link href="/liga?aba=rodadas" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 font-extrabold text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
        }
      />

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 px-3 pb-28 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-10">
        <section className="flex min-w-0 flex-col gap-4">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.15em] text-white/70">
            Liga da Várzea · Rodada {m.round} · {fmtKickoff(m.kickoff)}
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

          {!before && <Feed events={feed} tags={tags} mine={mySide ?? undefined} />}
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
                {POSTURES[posture].label}
                {pendingPosture ? ` (muda para ${POSTURES[Number(pendingPosture.change[1])].label} aos ${pendingPosture.tick}')` : ""} · Substituições: {subsDone}/5
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={!canAct || sending} onClick={() => setSheet("tatica")} className="btn btn-paper btn-sm flex-1 disabled:opacity-50">
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

      {mySide !== null && live && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5 lg:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            <button type="button" disabled={!canAct || sending} onClick={() => setSheet("tatica")} className="btn btn-paper min-w-0 flex-1 !px-2 disabled:opacity-50">
              <Icon name="clipboard" className="h-5 w-5 shrink-0" />
              <span className="truncate">{POSTURES[posture].label}</span>
            </button>
            <button type="button" disabled={!canAct || sending || subsDone >= 5} onClick={() => setSheet("subs")} className="btn btn-paper min-w-0 flex-1 !px-2 disabled:opacity-50">
              <Icon name="swap" className="h-5 w-5 shrink-0" />
              <span className="truncate">Substituir</span>
              <span className="t-num shrink-0 rounded bg-[var(--ink)] px-1 text-[0.65rem] text-white">{subsDone}/5</span>
            </button>
          </div>
        </div>
      )}

      {sheet && me && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(27,16,56,0.7)] sm:items-center" onClick={() => setSheet(null)}>
          <div className="anim-pop max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white sm:rounded-[24px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p className="text-xs font-bold text-white/60">A mudança vale cerca de {CHANGE_DELAY_TICKS} minutos de jogo depois (para chegar a todos).</p>
            {sheet === "tatica" ? (
              <>
                <p className="t-heading mt-2 text-lg">Postura</p>
                <div className="mt-3 grid gap-2">
                  {POSTURES.map((p, k) => (
                    <button
                      key={p.label}
                      type="button"
                      disabled={sending}
                      onClick={() => (k === posture ? setSheet(null) : void act(`p${k}`))}
                      className={`rounded-xl border-[3px] border-[var(--ink)] px-3 py-2 text-left ${k === posture ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 hover:bg-white/20"}`}
                    >
                      <span className="block font-extrabold">{p.label}</span>
                      <span className="block text-xs opacity-75">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
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
                          onClick={() => (subOut === null ? setSubOut(card) : void act(`x${subOut.toString(36)}${card.toString(36)}`))}
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
