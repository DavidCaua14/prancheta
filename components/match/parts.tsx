"use client";

import type { ReactNode } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import type { Crest } from "@/lib/club/identity";
import type { MatchEvent } from "@/lib/sim/engine";

export const EVENT_ICON: Partial<Record<MatchEvent["type"], string>> = {
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

export function clockText(e: { minute: number; extra?: number }) {
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
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
        <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-right text-sm font-extrabold text-white sm:text-base">
              <span className="sm:hidden">{home.tag}</span>
              <span className="hidden sm:inline">{home.name}</span>
            </span>
            <CrestSvg crest={home.crest} tag={home.tag} className="h-10 w-9 shrink-0" />
          </div>
          <div className="flex flex-col items-center">
            <span className="t-num rounded-lg bg-[var(--ink)] px-3 py-0.5 text-2xl leading-tight text-white sm:text-3xl" aria-live="polite">
              {score[0]}
              <span className="mx-1.5 text-[var(--sun)]">×</span>
              {score[1]}
            </span>
            <span className="t-num mt-0.5 text-xs text-[var(--sun)]">{status}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <CrestSvg crest={away.crest} tag={away.tag} className="h-10 w-9 shrink-0" />
            <span className="truncate text-sm font-extrabold text-white sm:text-base">
              <span className="sm:hidden">{away.tag}</span>
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
            className={`flex gap-3 border-b border-[var(--ink)]/10 px-3 py-2 text-sm last:border-0 sm:px-4 ${
              goal ? (good ? "bg-[var(--grass)]/30 font-extrabold" : "bg-[var(--red)]/15 font-extrabold") : e.type === "halftime" || e.type === "fulltime" ? "bg-[var(--cream)] font-bold" : ""
            }`}
          >
            <span className="t-num w-11 shrink-0 text-[var(--hot)]">{e.type === "kickoff" && e.tick === 0 ? "" : clockText(e)}</span>
            <span className="w-5 shrink-0 text-center">{EVENT_ICON[e.type] ?? ""}</span>
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
