"use client";

import { useEffect, useRef, useState } from "react";
import { initialState, rng, step, TACTICS, type SimTeam, type Tactic } from "@/lib/mini-sim";

const TEAMS: [SimTeam, SimTeam] = [
  {
    name: "Tubarões da Vila",
    short: "TUB",
    color: "var(--toon-sky)",
    strength: 71,
    players: ["Pirulito", "Zé Gotinha", "Tatu", "Marcão", "Dentinho", "Biscoito"],
  },
  {
    name: "Unidos do Morro",
    short: "UNI",
    color: "var(--toon-hot)",
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

export function MatchDemo() {
  const [tactic, setTactic] = useState<Tactic>("equilibrado");
  const [state, setState] = useState(() => initialState(20260001));
  const randRef = useRef<() => number>(rng(20260001));
  const tacticRef = useRef<Tactic>(tactic);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tacticRef.current = tactic;
  }, [tactic]);

  // Só simula quando a demo está visível na tela (economiza bateria).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.finished) {
          const seed = s.seed + 1;
          randRef.current = rng(seed);
          return initialState(seed);
        }
        return step(s, randRef.current, TEAMS, tacticRef.current);
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [visible]);

  const { ball } = state;
  const half = state.minute < 45 ? "1º T" : state.minute < 90 ? "2º T" : "FIM";

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
    <div ref={rootRef} className="mx-auto w-full max-w-3xl">
      {/* Gabinete de TV de tubo anos 90 */}
      <div className="toon-box relative bg-[#d8cfb8] p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border-[3px] border-[var(--toon-ink)] bg-[var(--toon-ink)] px-3 py-2 font-mono text-[var(--toon-sun)]">
          <span className="flex min-w-0 items-center gap-2 text-sm font-black sm:text-lg">
            <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white" style={{ background: TEAMS[0].color }} />
            <span className="truncate">{TEAMS[0].short}</span>
          </span>
          <span className="toon-title-sm shrink-0 text-2xl text-white sm:text-3xl" aria-live="polite">
            {state.score[0]} <span className="text-[var(--toon-sun)]">x</span> {state.score[1]}
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2 text-sm font-black sm:text-lg">
            <span className="truncate">{TEAMS[1].short}</span>
            <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white" style={{ background: TEAMS[1].color }} />
          </span>
          <span className="ml-1 shrink-0 rounded-md bg-[var(--toon-red)] px-2 py-0.5 text-xs font-black text-white sm:text-sm">
            {half} {String(state.minute).padStart(2, "0")}&apos;
          </span>
        </div>

        <div className="relative overflow-hidden rounded-[18px] border-[4px] border-[var(--toon-ink)]">
          <svg viewBox="0 0 100 64" className="toon-pitch block w-full" role="img" aria-label="Partida simulada ao vivo">
            <g fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.9">
              <rect x="2" y="2" width="96" height="60" rx="1" />
              <line x1="50" y1="2" x2="50" y2="62" />
              <circle cx="50" cy="32" r="8" />
              <rect x="2" y="18" width="13" height="28" />
              <rect x="85" y="18" width="13" height="28" />
              <rect x="2" y="25" width="5" height="14" />
              <rect x="93" y="25" width="5" height="14" />
            </g>
            <rect x="0" y="28" width="2" height="8" fill="#fff" stroke="var(--toon-ink)" strokeWidth="0.4" />
            <rect x="98" y="28" width="2" height="8" fill="#fff" stroke="var(--toon-ink)" strokeWidth="0.4" />

            {([0, 1] as const).map((team) =>
              FORMATION.map((_, i) => {
                const p = playerPos(team, i);
                return (
                  <g
                    key={`${team}-${i}`}
                    style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: `transform ${TICK_MS}ms ease-out` }}
                  >
                    <ellipse cx="0.4" cy="2.6" rx="2.4" ry="0.9" fill="rgba(0,0,0,0.25)" />
                    <circle
                      r="2.3"
                      fill={i === 0 ? "var(--toon-sun)" : TEAMS[team].color}
                      stroke="var(--toon-ink)"
                      strokeWidth="0.7"
                    />
                    <circle cx="-0.7" cy="-0.6" r="0.45" fill="var(--toon-ink)" />
                    <circle cx="0.7" cy="-0.6" r="0.45" fill="var(--toon-ink)" />
                  </g>
                );
              }),
            )}

            <g style={{ transform: `translate(${ball.x}px, ${ball.y}px)`, transition: `transform ${TICK_MS}ms cubic-bezier(.3,.7,.4,1)` }}>
              <ellipse cx="0.3" cy="1.6" rx="1.4" ry="0.5" fill="rgba(0,0,0,0.3)" />
              <circle r="1.3" fill="#fff" stroke="var(--toon-ink)" strokeWidth="0.5" />
              <circle r="0.45" fill="var(--toon-ink)" />
            </g>
          </svg>

          {state.goalFlash !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(255,210,63,0.25)]">
              <div className="toon-burst anim-pop flex h-40 w-56 items-center justify-center bg-[var(--toon-sun)] sm:h-52 sm:w-72">
                <span className="toon-title text-4xl text-white sm:text-6xl">GOOOL!</span>
              </div>
            </div>
          )}
          {/* linhas de varredura de TV */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)" }}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <ol
            className="toon-box-sm h-[150px] overflow-hidden bg-[var(--toon-paper)] px-3 py-2 font-mono text-[0.78rem] leading-snug text-[var(--toon-ink)]"
            aria-label="Narração do jogo"
          >
            {state.feed.map((e, idx) => (
              <li
                key={`${state.seed}-${e.minute}-${idx}-${e.text}`}
                className={`border-b border-dashed border-black/15 py-0.5 last:border-0 ${
                  e.kind === "goal" ? "font-black text-[var(--toon-grass-deep)]" : e.kind === "card" ? "font-bold text-[#b8860b]" : e.kind === "chance" ? "font-bold" : ""
                }`}
              >
                <span className="mr-1.5 font-black text-[var(--toon-hot)]">{String(e.minute).padStart(2, "0")}&apos;</span>
                {e.text}
              </li>
            ))}
          </ol>

          <fieldset className="toon-box-sm flex flex-col gap-1.5 bg-[var(--toon-ink)] p-2">
            <legend className="sr-only">Tática do seu time</legend>
            <span className="px-1 text-center text-[0.65rem] font-black uppercase tracking-widest text-[var(--toon-sun)]">
              Sua tática ({TEAMS[0].short})
            </span>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-1">
              {(Object.keys(TACTICS) as Tactic[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTactic(t)}
                  aria-pressed={tactic === t}
                  className={`rounded-full border-[3px] border-[var(--toon-ink)] px-3 py-1.5 text-xs font-black uppercase transition ${
                    tactic === t
                      ? "bg-[var(--toon-sun)] text-[var(--toon-ink)] shadow-[0_3px_0_#000]"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {TACTICS[t].label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* botões da TV */}
        <div aria-hidden className="mt-3 flex items-center justify-end gap-2">
          <span className="text-[0.6rem] font-black tracking-[0.3em] text-[var(--toon-ink)]/60">PRANCHETA-TV</span>
          <span className="h-3 w-3 rounded-full border-2 border-[var(--toon-ink)] bg-[var(--toon-red)] anim-blink" />
          <span className="h-5 w-5 rounded-full border-[3px] border-[var(--toon-ink)] bg-[#a39a83]" />
          <span className="h-5 w-5 rounded-full border-[3px] border-[var(--toon-ink)] bg-[#a39a83]" />
        </div>
      </div>
    </div>
  );
}
