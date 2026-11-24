"use client";

import { useEffect, useRef, useState } from "react";
import { initialState, rng, step, TACTICS, type SimTeam, type Tactic } from "@/lib/mini-sim";

const TEAMS: [SimTeam, SimTeam] = [
  {
    name: "Tubarões da Vila",
    short: "TUB",
    color: "var(--sky)",
    strength: 71,
    players: ["Pirulito", "Zé Gotinha", "Tatu", "Marcão", "Dentinho", "Biscoito"],
  },
  {
    name: "Unidos do Morro",
    short: "UNI",
    color: "var(--hot)",
    strength: 72,
    players: ["Canhota", "Juninho", "Pé de Pano", "Galo", "Mosquito", "Bigode"],
  },
];

// Formação base (x, y) em campo 100 x 64 — time da casa ataca para a direita.
const FORMATION = [
  [6, 32],
  [22, 14],
  [22, 50],
  [40, 32],
  [56, 18],
  [56, 46],
] as const;

const TICK_MS = 420;
const FIRST_SEED = 20260001;

type Status = "idle" | "playing" | "paused";

export function MatchDemo() {
  const [tactic, setTactic] = useState<Tactic>("equilibrado");
  const [status, setStatus] = useState<Status>("idle");
  const [state, setState] = useState(() => initialState(FIRST_SEED));
  const randRef = useRef<() => number>(rng(FIRST_SEED));
  const tacticRef = useRef<Tactic>(tactic);

  useEffect(() => {
    tacticRef.current = tactic;
  }, [tactic]);

  // Só roda quando o usuário manda; pausa sozinho se a aba ficar oculta.
  const finished = state.finished;
  useEffect(() => {
    if (status !== "playing" || finished) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setState((s) => step(s, randRef.current, TEAMS, tacticRef.current));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [status, finished]);

  function restart() {
    const seed = state.seed + 1;
    randRef.current = rng(seed);
    setState(initialState(seed));
    setStatus("playing");
  }

  const { ball } = state;
  const half = state.minute < 45 ? "1º tempo" : state.minute < 90 ? "2º tempo" : "Encerrado";
  const feed = [...state.feed].reverse().slice(0, 5);

  const playerPos = (team: 0 | 1, i: number) => {
    const [bx, by] = FORMATION[i];
    const baseX = team === 0 ? bx : 100 - bx;
    const pull = i === 0 ? 0.06 : 0.32;
    return {
      x: baseX + (ball.x - baseX) * pull,
      y: by + (ball.y - by) * (i === 0 ? 0.3 : 0.35),
    };
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-[26px] border-[3px] border-[var(--ink)] bg-[#e6dcc3] p-2.5 shadow-[0_6px_0_var(--ink)] sm:p-4">
        {/* placar */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--ink)] px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white" style={{ background: TEAMS[0].color }} />
            <span className="truncate text-sm font-extrabold text-white sm:text-base">
              <span className="sm:hidden">{TEAMS[0].short}</span>
              <span className="hidden sm:inline">{TEAMS[0].name}</span>
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="t-num whitespace-nowrap text-2xl leading-none text-white sm:text-3xl" aria-live="polite">
              {state.score[0]}
              <span className="mx-1.5 text-[var(--sun)]">×</span>
              {state.score[1]}
            </span>
            <span className="mt-1 whitespace-nowrap rounded bg-[var(--red)] px-1.5 text-[0.7rem] font-extrabold leading-5 text-white">
              {half} · <span className="t-num">{String(state.minute).padStart(2, "0")}&apos;</span>
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-right text-sm font-extrabold text-white sm:text-base">
              <span className="sm:hidden">{TEAMS[1].short}</span>
              <span className="hidden sm:inline">{TEAMS[1].name}</span>
            </span>
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white" style={{ background: TEAMS[1].color }} />
          </div>
        </div>

        {/* campo */}
        <div className="relative mt-2.5 overflow-hidden rounded-2xl border-[3px] border-[var(--ink)]">
          <svg viewBox="0 0 100 64" className="pitch block w-full" role="img" aria-label="Partida simulada">
            <g fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.9">
              <rect x="2" y="2" width="96" height="60" rx="1" />
              <line x1="50" y1="2" x2="50" y2="62" />
              <circle cx="50" cy="32" r="8" />
              <rect x="2" y="18" width="13" height="28" />
              <rect x="85" y="18" width="13" height="28" />
              <rect x="2" y="25" width="5" height="14" />
              <rect x="93" y="25" width="5" height="14" />
            </g>
            <rect x="0" y="28" width="2" height="8" fill="#fff" stroke="var(--ink)" strokeWidth="0.4" />
            <rect x="98" y="28" width="2" height="8" fill="#fff" stroke="var(--ink)" strokeWidth="0.4" />

            {([0, 1] as const).map((team) =>
              FORMATION.map((_, i) => {
                const p = playerPos(team, i);
                return (
                  <g
                    key={`${team}-${i}`}
                    style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: `transform ${TICK_MS}ms ease-out` }}
                  >
                    <ellipse cx="0.4" cy="2.6" rx="2.4" ry="0.9" fill="rgba(0,0,0,0.25)" />
                    <circle r="2.3" fill={i === 0 ? "var(--sun)" : TEAMS[team].color} stroke="var(--ink)" strokeWidth="0.7" />
                    <circle cx="-0.7" cy="-0.6" r="0.45" fill="var(--ink)" />
                    <circle cx="0.7" cy="-0.6" r="0.45" fill="var(--ink)" />
                  </g>
                );
              }),
            )}

            <g style={{ transform: `translate(${ball.x}px, ${ball.y}px)`, transition: `transform ${TICK_MS}ms cubic-bezier(.3,.7,.4,1)` }}>
              <ellipse cx="0.3" cy="1.6" rx="1.4" ry="0.5" fill="rgba(0,0,0,0.3)" />
              <circle r="1.3" fill="#fff" stroke="var(--ink)" strokeWidth="0.5" />
              <circle r="0.45" fill="var(--ink)" />
            </g>
          </svg>

          {state.goalFlash !== null && status === "playing" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="t-display anim-pop rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-6 py-2 text-3xl text-[var(--ink)] [text-shadow:none] sm:text-5xl">
                GOOOL!
              </span>
            </div>
          )}

          {(status === "idle" || finished) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[rgba(27,16,56,0.6)] p-4 text-center">
              {finished && (
                <p className="t-heading text-xl text-white sm:text-2xl">
                  Fim de jogo: {state.score[0]} × {state.score[1]}
                </p>
              )}
              <button type="button" onClick={finished ? restart : () => setStatus("playing")} className="btn btn-lg">
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
                  <path d="M5 3l12 7-12 7z" fill="currentColor" />
                </svg>
                {finished ? "Assistir outra" : "Assistir partida"}
              </button>
            </div>
          )}
        </div>

        {/* controles + narração */}
        <div className="mt-2.5 grid gap-2.5 md:grid-cols-[1fr_220px]">
          <div className="order-2 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)] md:order-1">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.15em] opacity-50">Narração</p>
            <ol className="mt-1 h-[150px] overflow-hidden text-sm leading-snug" aria-label="Narração do jogo">
              {feed.map((e, idx) => (
                <li
                  key={`${state.seed}-${state.feed.length - idx}`}
                  className={`flex gap-2 border-b border-dashed border-black/10 py-1 last:border-0 ${
                    e.kind === "goal" ? "font-extrabold text-[var(--grass-3)]" : e.kind === "card" ? "font-bold text-[#a86d00]" : e.kind === "chance" ? "font-bold" : ""
                  } ${idx > 0 ? "opacity-70" : ""}`}
                >
                  <span className="t-num w-7 shrink-0 text-[var(--hot)]">{String(e.minute).padStart(2, "0")}&apos;</span>
                  <span className="min-w-0">{e.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="order-1 flex flex-col gap-2 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-3 md:order-2">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.15em] text-[var(--sun)]">
              Sua tática · {TEAMS[0].short}
            </p>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-1" role="radiogroup" aria-label="Tática">
              {(Object.keys(TACTICS) as Tactic[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tactic === t}
                  onClick={() => setTactic(t)}
                  className={`h-10 rounded-xl border-[3px] border-[var(--ink)] px-2 text-sm font-extrabold transition-colors ${
                    tactic === t ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {TACTICS[t].label}
                </button>
              ))}
            </div>
            {status !== "idle" && !finished && (
              <button
                type="button"
                onClick={() => setStatus(status === "playing" ? "paused" : "playing")}
                className="btn btn-paper btn-sm mt-auto w-full"
              >
                {status === "playing" ? "Pausar" : "Continuar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
