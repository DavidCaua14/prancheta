"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { CameraButton, Feed, IconButton } from "@/components/match/parts";
import { useCamera } from "@/lib/sim/useCamera";
import { Icon } from "@/components/ui/Icon";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { decodeCrest } from "@/lib/club/identity";
import { hash32 } from "@/lib/cards/generate";
import { clubCards } from "@/lib/cards/squad";
import { simulate, type Change, type MatchEvent, type MatchResult } from "@/lib/sim/engine";
import { makeRival } from "@/lib/sim/rival";
import { FORMATIONS, fitLevel } from "@/lib/tactics/formations";
import { LINES, MARKINGS, PASSES, POSTURES, TEMPOS, WIDTHS, lineupFor } from "@/lib/tactics/lineup";
import { MatchBoard } from "@/components/match/MatchBoard";
import { TRAINING_SPEEDS } from "@/lib/sim/pace";
import { buildPlan, scoreAtTime, visibleEvents } from "@/lib/sim/board";
import { tickClock } from "@/components/match/parts";

/**
 * Velocidade do treino (ms por minuto de jogo). A liga e as copas andam a
 * 6 s por minuto (~10 min por jogo); o treino é mais rápido: ~3 min no 1x.
 */
export const SPEEDS = TRAINING_SPEEDS;
const COUNT_KEY = (id: string) => `prancheta:amistoso:${id}`;



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
  const [speed, setSpeed] = useState(0);
  const [sheet, setSheet] = useState<null | "tatica" | "subs">(null);
  const [subOut, setSubOut] = useState<number | null>(null);
  const [halfDone, setHalfDone] = useState(false);
  const [camera, toggleCamera] = useCamera();

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
    const squad = clubCards(club.id, club.squad, club.xp, club.won);
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

  // quadro animado: minuto contínuo entre um "tique" do relógio e o próximo
  const clockRef = useRef({ tick: 0, at: 0, running: false, ms: SPEEDS[1].ms });
  const runningNow = playing && !!result && tick < result.length && !(tick === result.secondHalfTick - 1 && !halfDone);
  useEffect(() => {
    clockRef.current = { tick, at: performance.now(), running: runningNow, ms: SPEEDS[speed].ms };
  }, [tick, runningNow, speed]);
  const getTime = useCallback(() => {
    const c = clockRef.current;
    return c.running ? c.tick + Math.min(0.999, (performance.now() - c.at) / c.ms) : c.tick;
  }, []);
  const boardSides = useMemo(
    () =>
      setup && club
        ? {
            home: { lineup: setup.lineup, squad: setup.squad, tag: club.tag },
            away: { lineup: setup.rival.lineup, squad: setup.rival.squad, tag: setup.rival.tag },
          }
        : null,
    [setup, club],
  );
  const plan = useMemo(() => (result && boardSides ? buildPlan(result, boardSides.home, boardSides.away, count) : null), [result, boardSides, count]);
  // minuto contínuo (atualiza a narração 8× por segundo enquanto o jogo corre)
  const [fine, setFine] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- acompanha o relógio quando ele pula/para
    setFine(getTime());
    if (!runningNow) return;
    const id = window.setInterval(() => setFine(getTime()), 125);
    return () => window.clearInterval(id);
  }, [runningNow, tick, getTime]);
  const visible = useMemo(
    () => (!result || !plan ? [] : tick >= result.length ? result.events : visibleEvents(plan, result.events, Math.max(fine, tick))),
    [result, plan, tick, fine],
  );

  if (!club || !setup || !result || !plan) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const { squad, lineup, rival } = setup;
  const ended = tick >= result.length;
  const score = ended ? result.score : scoreAtTime(plan, result.events, Math.max(fine, tick));
  const halftime = !ended && !halfDone && tick === result.secondHalfTick - 1;
  const running = playing && !halftime && !ended;
  // faixa de gol: durante quase um minuto depois de a bola entrar
  const flash =
    running && plan
      ? (result.events.find((e, i) => (e.type === "goal" || e.type === "penalty_goal") && fine >= plan.eventAt[i] && fine < plan.eventAt[i] + 0.9) ?? null)
      : null;
  const nowClock = tickClock(tick, result.secondHalfTick, result.length);
  const stats = liveStats(visible);
  const feed = [...visible].reverse();

  // estado atual do meu time (para substituições e tática)
  const myPosture = [...changes].reverse().find((c) => c.kind === "tactic" && c.posture !== undefined && c.minute <= tick + 1);
  const posture = myPosture && myPosture.kind === "tactic" ? (myPosture.posture ?? lineup.posture) : lineup.posture;
  // linha / jogo / ritmo em vigor (escalação + mudanças feitas no treino)
  const currentOf = (key: "line" | "width" | "tempo") => {
    const ch = [...changes].reverse().find((c) => c.kind === "tactic" && c[key] !== undefined && c.minute <= tick + 1);
    return ch && ch.kind === "tactic" ? (ch[key] ?? 1) : (lineup[key] ?? 1);
  };
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
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
            <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
              <span className="truncate text-right text-sm font-extrabold text-white sm:text-base">
                <span className="whitespace-nowrap sm:hidden">{club.tag}</span>
                <span className="hidden sm:inline">{club.name}</span>
              </span>
              <CrestSvg crest={decodeCrest(club.crest)} tag={club.tag} className="h-8 w-7 shrink-0 sm:h-10 sm:w-9" />
            </div>
            <div className="flex flex-col items-center">
              <span className="t-num whitespace-nowrap rounded-lg bg-[var(--ink)] px-2 py-0.5 text-xl leading-tight text-white sm:px-3 sm:text-3xl" aria-live="polite">
                {score[0]}
                <span className="mx-1 text-[var(--sun)] sm:mx-1.5">×</span>
                {score[1]}
              </span>
              <span className="t-num mt-0.5 text-xs text-[var(--sun)]">{ended ? "FIM" : halftime ? "INTERVALO" : nowClock}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <CrestSvg crest={rival.crest} tag={rival.tag} className="h-8 w-7 shrink-0 sm:h-10 sm:w-9" />
              <span className="truncate text-sm font-extrabold text-white sm:text-base">
                <span className="whitespace-nowrap sm:hidden">{rival.tag}</span>
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
                <Icon name="play" className="h-5 w-5" />
                Começar partida
              </button>
            </div>
          )}

          {halftime && (
            <div className="mb-4 rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--sun)] p-4 text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
              <p className="t-heading text-lg">Intervalo!</p>
              <p className="text-sm font-semibold">Hora de mexer no time: troque a postura ou faça substituições antes do segundo tempo.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.3fr]">
                <button type="button" onClick={() => setSheet("tatica")} className="btn btn-paper btn-sm w-full">
                  <Icon name="clipboard" className="h-4 w-4" />
                  Tática
                </button>
                <button type="button" onClick={() => setSheet("subs")} className="btn btn-paper btn-sm w-full">
                  <Icon name="swap" className="h-4 w-4" />
                  Substituir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHalfDone(true);
                    setPlaying(true);
                  }}
                  className="btn btn-green btn-sm col-span-2 w-full sm:col-span-1"
                >
                  <Icon name="play" className="h-4 w-4" />
                  Começar o 2º tempo
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
                <button type="button" onClick={restart} className="btn btn-green">
                  <Icon name="restart" className="h-4 w-4" />
                  Jogar outro treino
                </button>
                <Link href="/escalacao" className="btn btn-paper">Ajustar escalação</Link>
              </div>
            </div>
          )}

          {boardSides && camera && (
            <div className="mb-4">
              <MatchBoard
                plan={plan}
                getTime={getTime}
                labels={[
                  `${club.tag} · ${formation.name} · ${POSTURES[posture].label}`,
                  `${rival.tag} · ${FORMATIONS[rival.lineup.formation].name} · ${POSTURES[rival.lineup.posture].label}`,
                ]}
              />
            </div>
          )}
          <Feed events={feed} tags={[club.tag, rival.tag]} mine={0} />
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
              <button type="button" disabled={!canChange} onClick={() => setSheet("tatica")} className="btn btn-paper btn-sm flex-1 disabled:opacity-50">
                <Icon name="clipboard" className="h-4 w-4" />
                Tática
              </button>
              <button type="button" disabled={!canChange || subsDone >= 5} onClick={() => setSheet("subs")} className="btn btn-paper btn-sm flex-1 disabled:opacity-50">
                <Icon name="swap" className="h-4 w-4" />
                Substituir
              </button>
            </div>
          </div>
        </aside>
        <div className="lg:hidden">{(ended || tick > 0) && statsPanel}</div>
      </div>

      {/* controles */}
      {!ended && tick > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5 lg:static lg:mx-auto lg:mb-8 lg:w-full lg:max-w-5xl lg:rounded-[20px] lg:border-[3px] lg:px-4 lg:py-3">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <IconButton
              icon={running ? "pause" : "play"}
              label={running ? "Pausar" : "Continuar"}
              tone="green"
              onClick={() => {
                if (halftime) setHalfDone(true);
                setPlaying(!running);
              }}
            />
            {/* velocidade: 1 toque alterna no celular; segmentado a partir de 640px */}
            <button
              type="button"
              onClick={() => setSpeed((speed + 1) % SPEEDS.length)}
              aria-label={`Velocidade ${SPEEDS[speed].label}`}
              className="t-num flex h-11 w-12 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-black/25 text-sm text-[var(--sun)] sm:hidden"
            >
              {SPEEDS[speed].label}
            </button>
            <div className="hidden rounded-xl border-[3px] border-[var(--ink)] bg-black/25 p-0.5 sm:flex" role="radiogroup" aria-label="Velocidade">
              {SPEEDS.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  role="radio"
                  aria-checked={speed === i}
                  onClick={() => setSpeed(i)}
                  className={`t-num h-9 w-10 rounded-lg text-xs ${speed === i ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 justify-center gap-2 lg:hidden">
              <IconButton icon="clipboard" label="Tática" showLabel disabled={!canChange} onClick={() => setSheet("tatica")} />
              <IconButton icon="swap" label="Substituir" showLabel disabled={!canChange || subsDone >= 5} onClick={() => setSheet("subs")} />
            </div>
            <span className="hidden flex-1 lg:block" />
            <CameraButton on={camera} onClick={toggleCamera} />
            <IconButton
              icon="skip"
              label="Ir para o fim"
              tone="ghost"
              showLabel
              onClick={() => {
                setHalfDone(true);
                setTick(result.length);
              }}
            />
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
                {(
                  [
                    ["Linha defensiva", "line", LINES],
                    ["Jogo", "width", WIDTHS],
                    ["Ritmo", "tempo", TEMPOS],
                  ] as const
                ).map(([label, key, options]) => {
                  const current = currentOf(key);
                  return (
                    <div key={key} className="mt-4">
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">{label}</p>
                      <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border-[3px] border-[var(--ink)] bg-black/25 p-1">
                        {options.map((o, k) => (
                          <button
                            key={o.label}
                            type="button"
                            onClick={() => {
                              if (k !== current) addChange({ minute: tick + 1, team: 0, kind: "tactic", [key]: k });
                              setSheet(null);
                              setPlaying(true);
                            }}
                            className={`min-h-9 rounded-lg px-1 text-xs font-extrabold ${k === current ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80 hover:bg-white/10"}`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
