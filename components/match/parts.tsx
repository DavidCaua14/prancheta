"use client";

import type { ReactNode } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { EventIcon, Icon } from "@/components/ui/Icon";
import type { Crest } from "@/lib/club/identity";
import type { MatchEvent } from "@/lib/sim/engine";

export function clockText(e: { minute: number; extra?: number }) {
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
}

/** Minuto do relógio para um "tique" do motor (com acréscimos: 45+2', 90+3'). */
export function tickClock(tick: number, secondHalfTick: number, length: number) {
  const extra1 = secondHalfTick - 46;
  const t = Math.max(0, Math.min(length, Math.floor(tick)));
  if (t <= 45 + extra1) return t <= 45 ? `${t}'` : `45+${t - 45}'`;
  const m = t - extra1;
  return m <= 90 ? `${m}'` : `90+${m - 90}'`;
}

export function liveStats(events: MatchEvent[]) {
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

type Side = { name: string; tag: string; crest: Crest };

export function Scoreboard({
  home,
  away,
  score,
  status,
  left,
  progress,
}: {
  home: Side;
  away: Side;
  score: [number, number];
  status: ReactNode;
  left?: ReactNode;
  progress?: number;
}) {
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:px-6">
        {left}
        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <span className="truncate text-right text-sm font-extrabold text-white sm:text-base">
              <span className="whitespace-nowrap sm:hidden">{home.tag}</span>
              <span className="hidden sm:inline">{home.name}</span>
            </span>
            <CrestSvg crest={home.crest} tag={home.tag} className="h-8 w-7 shrink-0 sm:h-10 sm:w-9" />
          </div>
          <div className="flex flex-col items-center">
            <span className="t-num whitespace-nowrap rounded-lg bg-[var(--ink)] px-2 py-0.5 text-xl leading-tight text-white sm:px-3 sm:text-3xl" aria-live="polite">
              {score[0]}
              <span className="mx-1 text-[var(--sun)] sm:mx-1.5">×</span>
              {score[1]}
            </span>
            <span className="t-num mt-0.5 text-xs text-[var(--sun)]">{status}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <CrestSvg crest={away.crest} tag={away.tag} className="h-8 w-7 shrink-0 sm:h-10 sm:w-9" />
            <span className="truncate text-sm font-extrabold text-white sm:text-base">
              <span className="whitespace-nowrap sm:hidden">{away.tag}</span>
              <span className="hidden sm:inline">{away.name}</span>
            </span>
          </div>
        </div>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 bg-black/30">
          <div className="h-full bg-[var(--grass)] transition-[width] duration-500" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
    </header>
  );
}

export function Feed({ events, tags, mine }: { events: MatchEvent[]; tags: [string, string]; mine?: 0 | 1 }) {
  return (
    <ol className="overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)]" aria-label="Narração">
      {events.length === 0 && <li className="px-4 py-6 text-center text-sm opacity-60">A narração aparece aqui, lance a lance.</li>}
      {events.map((e, i) => {
        const goal = e.type === "goal" || e.type === "penalty_goal";
        const good = mine === undefined ? e.team === 0 : e.team === mine;
        return (
          <li
            key={`${e.tick}-${i}-${e.type}`}
            className={`flex items-start gap-2 border-b border-[var(--ink)]/10 px-3 py-2 text-sm last:border-0 sm:gap-3 sm:px-4 ${
              goal ? (good ? "bg-[var(--grass)]/30 font-extrabold" : "bg-[var(--red)]/15 font-extrabold") : e.type === "halftime" || e.type === "fulltime" ? "bg-[var(--cream)] font-bold" : ""
            }`}
          >
            <span className="t-num w-10 shrink-0 text-[var(--hot)] sm:w-11">{e.type === "kickoff" && e.tick === 0 ? "" : clockText(e)}</span>
            <EventIcon type={e.type} className="mt-px h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 flex-1">
              {e.team !== undefined && (
                <span className={`mr-1.5 rounded px-1 text-[0.62rem] font-extrabold ${e.team === 0 ? "bg-[var(--sky)]" : "bg-[var(--hot)] text-white"}`}>{tags[e.team]}</span>
              )}
              {e.text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatsPanel({ rows }: { rows: [string, string | number, string | number][] }) {
  return (
    <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)]">
      <p className="t-heading mb-3">Estatísticas</p>
      {rows.map(([label, a, b]) => (
        <div key={label} className="grid grid-cols-[3rem_1fr_3rem] items-center border-b border-white/10 py-1.5 text-sm last:border-0">
          <span className="t-num">{a}</span>
          <span className="text-center text-xs font-bold text-white/60">{label}</span>
          <span className="t-num text-right">{b}</span>
        </div>
      ))}
    </div>
  );
}

/** Botão quadrado só com ícone (barras de controle no celular). */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  tone = "paper",
  showLabel = false,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "paper" | "green" | "ghost";
  showLabel?: boolean;
}) {
  const tones = {
    paper: "bg-[var(--paper)] text-[var(--ink)] border-[var(--ink)] shadow-[0_3px_0_var(--ink)]",
    green: "bg-[var(--grass)] text-[var(--ink)] border-[var(--ink)] shadow-[0_3px_0_var(--ink)]",
    ghost: "bg-transparent text-white border-white/35",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border-[3px] px-2.5 text-sm font-extrabold transition-transform active:translate-y-0.5 disabled:opacity-45 ${tones[tone]}`}
    >
      <Icon name={icon} className="h-5 w-5" />
      {showLabel && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
