"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { decodeCrest } from "@/lib/club/identity";
import { hash32 } from "@/lib/cards/generate";
import { squadCards } from "@/lib/cards/squad";
import { simulate, type Change, type MatchEvent, type MatchResult } from "@/lib/sim/engine";
import { makeRival } from "@/lib/sim/rival";
import { FORMATIONS, fitLevel } from "@/lib/tactics/formations";
import { MARKINGS, PASSES, POSTURES, lineupFor } from "@/lib/tactics/lineup";

const SPEEDS = [
  { label: "1x", ms: 650 },
  { label: "2x", ms: 300 },
  { label: "4x", ms: 120 },
];
const COUNT_KEY = (id: string) => `prancheta:amistoso:${id}`;

const ICON: Partial<Record<MatchEvent["type"], string>> = {
  goal: "⚽",
  penalty_goal: "⚽",
  penalty_miss: "❌",
  save: "🧤",
  post: "🥅",
  yellow: "🟨",
  red: "🟥",
  sub: "🔁",
  injury: "🚑",
  tactic: "📋",
  halftime: "⏸",
  fulltime: "🏁",
  kickoff: "▶",
};

function clockText(e: { minute: number; extra?: number }) {
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
}

/** Estatísticas parciais a partir dos lances já mostrados. */
function liveStats(events: MatchEvent[]) {
  const s = [0, 1].map(() => ({ shots: 0, onTarget: 0, corners: 0, yellows: 0, reds: 0 }));
  for (const e of events) {
    if (e.team === undefined) continue;
    const t = s[e.team];
    if (["goal", "save", "miss", "post", "block", "penalty_goal", "penalty_miss"].includes(e.type)) t.shots++;
    if (["goal", "save", "penalty_goal"].includes(e.type)) t.onTarget++;
    if (e.type === "corner") t.corners++;
    if (e.type === "yellow") t.yellows++;
    if (e.type === "red") t.reds++;
  }
  return s;
}

export function MatchViewer() {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [count, setCount] = useState(1);
  const [changes, setChanges] = useState<Change[]>([]);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sheet, setSheet] = useState<null | "tatica" | "subs">(null);
  const [subOut, setSubOut] = useState<number | null>(null);
  const [halfDone, setHalfDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getSession();
      if (!alive) return;
      if (!s) return router.replace("/entrar");
      try {
        const c = await getMyClub(s);
        if (!alive) return;
        if (!c) return router.replace("/clube/novo");
        if (!c.squad) return router.replace("/peneira");
        let n = 1;
        try {
          n = Number(localStorage.getItem(COUNT_KEY(c.id)) ?? "1") || 1;
        } catch {}
        setCount(n);
        setClub(c);
      } catch {
        router.replace("/entrar?erro=1");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const setup = useMemo(() => {
    if (!club) return null;
    const squad = squadCards(club.id, club.squad) ?? [];
    const lineup = lineupFor(club.lineup, squad);
    const rival = makeRival(club.id);
    return { squad, lineup, rival };
  }, [club]);

  const result: MatchResult | null = useMemo(() => {
    if (!club || !setup) return null;
    return simulate({
      seed: hash32(`${club.id}:amistoso:${count}`),
      home: { name: club.name, short: club.tag, squad: setup.squad, lineup: setup.lineup, ai: false },
      away: { name: setup.rival.name, short: setup.rival.tag, squad: setup.rival.squad, lineup: setup.rival.lineup, ai: true },
      changes,
    });
  }, [club, setup, count, changes]);

  // relógio: para sozinho no intervalo (até o técnico liberar) e no fim
  const limit = result ? (halfDone ? result.length : result.secondHalfTick - 1) : 0;
  useEffect(() => {
    if (!playing || !result) return;
    const id = window.setInterval(() => {
      setTick((t) => Math.min(limit, t + 1));
    }, SPEEDS[speed].ms);
    return () => window.clearInterval(id);
  }, [playing, speed, result, limit]);

  const visible = useMemo(() => (result ? result.events.filter((e) => e.tick <= tick) : []), [result, tick]);
  const last = visible[visible.length - 1];

  if (!club || !setup || !result) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const { squad, lineup, rival } = setup;
  const ended = tick >= result.length;
  const score = last ? last.score : [0, 0];
  const halftime = !ended && !halfDone && tick === result.secondHalfTick - 1;
  const running = playing && !halftime && !ended;
  const flash = running && last && (last.type === "goal" || last.type === "penalty_goal") && last.tick === tick ? last : null;
  const nowClock = last ? clockText(last) : "0'";
  const stats = liveStats(visible);
  const feed = [...visible].reverse().filter((e) => e.type !== "corner" || ended);

  // estado atual do meu time (para substituições e tática)
  const myPosture = [...changes].reverse().find((c) => c.kind === "tactic" && c.posture !== undefined && c.minute <= tick + 1);
  const posture = myPosture && myPosture.kind === "tactic" ? (myPosture.posture ?? lineup.posture) : lineup.posture;
  const formation = FORMATIONS[lineup.formation];
  const field = formation.slots.map((s, i) => ({ role: s.role, card: lineup.xi[i], out: false }));
  const usedBench = new Set<number>();
  let subsDone = 0;
  for (const e of visible) {
    if (e.team !== 0) continue;
    if (e.type === "sub" && e.player !== undefined && e.other !== undefined) {
      const f = field.find((x) => x.card === e.other);
      if (f) f.card = e.player;
      usedBench.add(e.player);
      subsDone++;
    }
    if (e.type === "red") {
      const f = field.find((x) => x.card === e.player);
      if (f) f.out = true;
    }
  }
  const pendingSub = changes.some((c) => c.kind === "sub" && c.minute > tick);
  const bench = squad.map((_, i) => i).filter((i) => !lineup.xi.includes(i) && !usedBench.has(i));
  const canChange = !ended && !pendingSub;

  function addChange(ch: Change) {
    setChanges((prev) => [...prev, ch]);
  }

  function restart() {
    const n = count + 1;
    try {
      localStorage.setItem(COUNT_KEY(club!.id), String(n));
    } catch {}
    setCount(n);
    setChanges([]);
    setTick(0);
    setHalfDone(false);
    setPlaying(true);
  }

  const teamName = (t?: 0 | 1) => (t === 0 ? club.tag : t === 1 ? rival.tag : "");

  const statsPanel = (
    <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)]">
      <p className="t-heading mb-3">Estatísticas</p>
      {(
        [
          ["Posse de bola", ended ? `${result.stats[0].possession}%` : "–", ended ? `${result.stats[1].possession}%` : "–"],
          ["Finalizações", stats[0].shots, stats[1].shots],
          ["No gol", stats[0].onTarget, stats[1].onTarget],
          ["Escanteios", stats[0].corners, stats[1].corners],
          ["Amarelos", stats[0].yellows, stats[1].yellows],
          ["Vermelhos", stats[0].reds, stats[1].reds],
        ] as const
      ).map(([label, a, b]) => (
        <div key={label} className="grid grid-cols-[3rem_1fr_3rem] items-center border-b border-white/10 py-1.5 text-sm last:border-0">
          <span className="t-num">{a}</span>
          <span className="text-center text-xs font-bold text-white/60">{label}</span>
          <span className="t-num text-right">{b}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* placar */}
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 font-extrabold text-white" aria-label="Voltar">
            ←
          </Link>
          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-right text-sm font-extrabold text-white sm:text-base">
                <span className="sm:hidden">{club.tag}</span>
                <span className="hidden sm:inline">{club.name}</span>
              </span>
              <CrestSvg crest={decodeCrest(club.crest)} tag={club.tag} className="h-10 w-9 shrink-0" />
            </div>
            <div className="flex flex-col items-center">
              <span className="t-num rounded-lg bg-[var(--ink)] px-3 py-0.5 text-2xl leading-tight text-white sm:text-3xl" aria-live="polite">
                {score[0]}
                <span className="mx-1.5 text-[var(--sun)]">×</span>
                {score[1]}
              </span>
              <span className="t-num mt-0.5 text-xs text-[var(--sun)]">{ended ? "FIM" : halftime ? "INTERVALO" : nowClock}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <CrestSvg crest={rival.crest} tag={rival.tag} className="h-10 w-9 shrink-0" />
              <span className="truncate text-sm font-extrabold text-white sm:text-base">
                <span className="sm:hidden">{rival.tag}</span>
                <span className="hidden sm:inline">{rival.name}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-black/30">
          <div className="h-full bg-[var(--grass)] transition-[width] duration-300" style={{ width: `${(tick / result.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 px-3 pb-36 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-10">
        {/* narração */}
        <section className="min-w-0">
          {tick === 0 && !playing && (
            <div className="mb-4 rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-5 text-center text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
              <span className="tag">Amistoso de treino</span>
              <p className="t-heading mt-3 text-xl">
                {club.name} × {rival.name}
              </p>
              <p className="mt-1 text-sm opacity-70">
                {FORMATIONS[lineup.formation].name} · {POSTURES[lineup.posture].label} contra {FORMATIONS[rival.lineup.formation].name}. Treino não vale
                pontos.
              </p>
              <button type="button" onClick={() => setPlaying(true)} className="btn btn-green btn-lg mt-4 w-full sm:w-auto">
                ▶ Começar partida
              </button>
            </div>
          )}

          {halftime && (
            <div className="mb-4 rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--sun)] p-4 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
              <p className="t-heading text-lg">Intervalo!</p>
              <p className="text-sm font-semibold">Hora de mexer no time: troque a postura ou faça substituições antes do segundo tempo.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setSheet("tatica")} className="btn btn-paper btn-sm">📋 Tática</button>
                <button type="button" onClick={() => setSheet("subs")} className="btn btn-paper btn-sm">🔁 Substituir</button>
                <button
                  type="button"
                  onClick={() => {
                    setHalfDone(true);
                    setPlaying(true);
                  }}
                  className="btn btn-green btn-sm ml-auto"
                >
                  ▶ 2º tempo
                </button>
              </div>
            </div>
          )}

          {ended && (
            <div className="mb-4 rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-5 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
              <span className="tag">Fim de jogo</span>
              <p className="t-display mt-2 text-3xl [text-shadow:0.05em_0.05em_0_var(--sun)]">
                {result.score[0] > result.score[1] ? "Vitória!" : result.score[0] < result.score[1] ? "Derrota" : "Empate"}
              </p>
              {(() => {
                const best = Object.entries(result.ratings[0]).sort((a, b) => b[1] - a[1])[0];
                return best ? (
                  <p className="mt-1 text-sm font-semibold opacity-75">
                    Destaque do seu time: <strong>{squad[+best[0]].name}</strong> (nota {best[1].toFixed(1)})
                  </p>
                ) : null;
              })()}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={restart} className="btn btn-green">↻ Jogar outro treino</button>
                <Link href="/escalacao" className="btn btn-paper">Ajustar escalação</Link>
              </div>
            </div>
          )}

          <ol className="overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)]" aria-label="Narração">
            {feed.length === 0 && <li className="px-4 py-6 text-center text-sm opacity-60">A narração aparece aqui, lance a lance.</li>}
            {feed.map((e, i) => {
              const goal = e.type === "goal" || e.type === "penalty_goal";
              const mine = e.team === 0;
              return (
                <li
                  key={`${e.tick}-${i}-${e.type}`}
                  className={`flex gap-3 border-b border-[var(--ink)]/10 px-3 py-2 text-sm last:border-0 sm:px-4 ${
                    goal ? (mine ? "bg-[var(--grass)]/30 font-extrabold" : "bg-[var(--red)]/15 font-extrabold") : e.type === "halftime" || e.type === "fulltime" ? "bg-[var(--cream)] font-bold" : ""
                  }`}
                >
                  <span className="t-num w-11 shrink-0 text-[var(--hot)]">{e.type === "kickoff" && e.tick === 0 ? "" : clockText(e)}</span>
                  <span className="w-5 shrink-0 text-center">{ICON[e.type] ?? ""}</span>
                  <span className="min-w-0 flex-1">
                    {e.team !== undefined && (
                      <span className={`mr-1.5 rounded px-1 text-[0.62rem] font-extrabold ${mine ? "bg-[var(--sky)]" : "bg-[var(--hot)] text-white"}`}>{teamName(e.team)}</span>
                    )}
                    {e.text}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* lado: estatísticas e tática (desktop) */}
        <aside className="hidden flex-col gap-4 lg:flex">
          {statsPanel}
          <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)]">
            <p className="t-heading">Seu time</p>
            <p className="mt-1 text-sm text-white/70">
              {formation.name} · {POSTURES[posture].label} · {MARKINGS[lineup.marking].label} · {PASSES[lineup.passing].label}
            </p>
            <p className="mt-1 text-sm text-white/70">Substituições: {subsDone}/5</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={!canChange} onClick={() => setSheet("tatica")} className="btn btn-paper btn-sm flex-1 disabled:opacity-50">📋 Tática</button>
              <button type="button" disabled={!canChange || subsDone >= 5} onClick={() => setSheet("subs")} className="btn btn-paper btn-sm flex-1 disabled:opacity-50">🔁 Substituir</button>
            </div>
          </div>
        </aside>
        <div className="lg:hidden">{(ended || tick > 0) && statsPanel}</div>
      </div>

      {/* controles */}
      {!ended && tick > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5 lg:static lg:mx-auto lg:mb-8 lg:w-full lg:max-w-5xl lg:rounded-[20px] lg:border-[3px] lg:px-4 lg:py-3">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (halftime) setHalfDone(true);
                setPlaying(!running);
              }}
              className="btn btn-green w-14 !px-0"
              aria-label={running ? "Pausar" : "Continuar"}
            >
              {running ? "❚❚" : "▶"}
            </button>
            <div className="flex rounded-xl border-[3px] border-[var(--ink)] bg-black/25 p-0.5" role="radiogroup" aria-label="Velocidade">
              {SPEEDS.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  role="radio"
                  aria-checked={speed === i}
                  onClick={() => setSpeed(i)}
                  className={`t-num h-9 w-9 rounded-lg text-xs ${speed === i ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button type="button" disabled={!canChange} onClick={() => setSheet("tatica")} className="btn btn-paper btn-sm lg:hidden disabled:opacity-50" aria-label="Tática">📋</button>
            <button type="button" disabled={!canChange || subsDone >= 5} onClick={() => setSheet("subs")} className="btn btn-paper btn-sm lg:hidden disabled:opacity-50" aria-label="Substituir">🔁</button>
            <button
              type="button"
              onClick={() => {
                setHalfDone(true);
                setTick(result.length);
              }}
              className="btn btn-ghost btn-sm ml-auto"
            >
              Fim ⏭
            </button>
          </div>
        </div>
      )}

      {/* folhas: tática e substituição */}
      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(27,16,56,0.7)] sm:items-center" onClick={() => setSheet(null)}>
          <div
            className="anim-pop max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {sheet === "tatica" ? (
              <>
                <p className="t-heading text-lg">Postura a partir de agora</p>
                <div className="mt-3 grid gap-2">
                  {POSTURES.map((p, i) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        if (i !== posture) addChange({ minute: tick + 1, team: 0, kind: "tactic", posture: i });
                        setSheet(null);
                        setPlaying(true);
                      }}
                      className={`rounded-xl border-[3px] border-[var(--ink)] px-3 py-2 text-left ${i === posture ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 hover:bg-white/20"}`}
                    >
                      <span className="block font-extrabold">{p.label}</span>
                      <span className="block text-xs opacity-75">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="t-heading text-lg">Substituição ({subsDone}/5)</p>
                <p className="mt-1 text-xs text-white/70">{subOut === null ? "Quem sai?" : "Quem entra?"}</p>
                <ul className="mt-3 grid gap-1.5">
                  {(subOut === null ? field.filter((f) => !f.out).map((f) => ({ card: f.card, role: f.role })) : bench.map((b) => ({ card: b, role: field.find((f) => f.card === subOut)!.role }))).map(
                    ({ card, role }) => {
                      const c = squad[card];
                      const lvl = fitLevel(c, role);
                      return (
                        <li key={card}>
                          <button
                            type="button"
                            onClick={() => {
                              if (subOut === null) return setSubOut(card);
                              addChange({ minute: tick + 1, team: 0, kind: "sub", out: subOut, in: card });
                              setSubOut(null);
                              setSheet(null);
                              setPlaying(true);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl border-[3px] border-[var(--ink)] bg-white/10 px-3 py-2 text-left hover:bg-white/20"
                          >
                            <span className="t-num w-9 rounded bg-[var(--ink)] py-0.5 text-center text-[0.65rem]">{subOut === null ? role : c.position}</span>
                            <span className="flex-1 truncate font-bold">{c.name}</span>
                            {subOut !== null && lvl !== "ok" && (
                              <span className={`rounded px-1 text-[0.6rem] font-extrabold ${lvl === "bad" ? "bg-[var(--red)]" : "bg-[var(--sun)] text-[var(--ink)]"}`}>
                                {lvl === "bad" ? "improvisado" : "adaptado"}
                              </span>
                            )}
                            <span className="t-num">{c.overall}</span>
                          </button>
                        </li>
                      );
                    },
                  )}
                  {subOut !== null && bench.length === 0 && <li className="text-sm text-white/70">Sem reservas disponíveis.</li>}
                </ul>
              </>
            )}
            <button type="button" onClick={() => (setSheet(null), setSubOut(null))} className="btn btn-ghost mt-4 w-full">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* GOL! */}
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className={`anim-pop rounded-[24px] border-[4px] border-[var(--ink)] px-8 py-4 text-center shadow-[0_8px_0_var(--ink)] ${flash.team === 0 ? "bg-[var(--sun)]" : "bg-[var(--paper)]"}`}>
            <p className="t-display text-5xl text-[var(--ink)] [text-shadow:none]">GOOOL!</p>
            <p className="mt-1 font-extrabold text-[var(--ink)]">
              {flash.team !== undefined && flash.player !== undefined ? (flash.team === 0 ? squad : rival.squad)[flash.player].name : ""} · {teamName(flash.team)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
