"use client";

/**
 * Dados de uma liga + cálculo dos jogos e da tabela no aparelho.
 * Leituras: 4 consultas pequenas por liga (liga, rodadas, clubes, escalações)
 * + as mudanças ao vivo. Nada de placar no banco.
 */
import type { BaseCard } from "@/lib/cards/generate";
import { squadCards } from "@/lib/cards/squad";
import { decodeCrest, decodeKit, type Crest, type Kit } from "@/lib/club/identity";
import { simulate, type Change, type MatchResult, type TeamInput } from "@/lib/sim/engine";
import { supabase } from "@/lib/supabase/client";
import { lineupFor, type Lineup } from "@/lib/tactics/lineup";
import { botTeam } from "./bots";
import { doubleRoundRobin, type Fixture } from "./schedule";
import { hash32 } from "@/lib/cards/generate";

/** 1 minuto de jogo = 6 segundos (o mesmo valor está no banco: match_change_ok). */
export const TICK_SECONDS = 6;

export type LeagueRow = { id: number; division: number; size: number; rounds: number; starts_at: string; ends_at: string };
export type LeagueClub = {
  id: string;
  name: string;
  tag: string;
  crest: string;
  kit: string;
  squad: string;
  league_slot: number;
  joined_round: number;
};
export type LogRow = { club_id: string; at: string; lineup: string };
export type ChangeRow = { round: number; club_id: string; tick: number; change: string };

export type LeagueData = {
  league: LeagueRow;
  kickoffs: number[]; // ms, índice = rodada - 1
  clubs: LeagueClub[];
  logs: LogRow[];
  changes: ChangeRow[];
  fixtures: Fixture[][];
  loadedAt: number;
};

export type TeamView = {
  slot: number;
  name: string;
  tag: string;
  crest: Crest;
  kit: Kit;
  bot: boolean;
  clubId?: string;
  squad: BaseCard[];
};

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

export async function joinLeague(): Promise<number> {
  const { data, error } = await supabase().rpc("join_league");
  if (error) throw error;
  return data as number;
}

export async function loadLeague(leagueId: number): Promise<LeagueData> {
  const sb = supabase();
  const [lg, rounds, clubs, changes] = await Promise.all([
    sb.from("leagues").select("id,division,size,rounds,starts_at,ends_at").eq("id", leagueId).single(),
    sb.from("league_rounds").select("round,kickoff").eq("league_id", leagueId).order("round"),
    sb.from("clubs").select("id,name,tag,crest,kit,squad,league_slot,joined_round").eq("league_id", leagueId),
    sb.from("match_changes").select("round,club_id,tick,change").eq("league_id", leagueId),
  ]);
  if (lg.error) throw lg.error;
  if (rounds.error) throw rounds.error;
  if (clubs.error) throw clubs.error;
  const league = lg.data as LeagueRow;
  const ids = (clubs.data ?? []).map((c) => c.id);
  const since = new Date(new Date(league.starts_at).getTime() - 11 * 86400_000).toISOString();
  const logs = ids.length
    ? await sb.from("lineup_log").select("club_id,at,lineup").in("club_id", ids).gte("at", since).order("at")
    : { data: [], error: null };
  if (logs.error) throw logs.error;
  return {
    league,
    kickoffs: (rounds.data ?? []).map((r) => new Date(r.kickoff).getTime()),
    clubs: (clubs.data ?? []) as LeagueClub[],
    logs: (logs.data ?? []) as LogRow[],
    changes: (changes.data ?? []) as ChangeRow[],
    fixtures: doubleRoundRobin(league.size),
    loadedAt: Date.now(),
  };
}

/** Relê só as mudanças ao vivo de uma rodada (usado durante o jogo). */
export async function refreshChanges(data: LeagueData, round: number): Promise<LeagueData> {
  const { data: rows, error } = await supabase()
    .from("match_changes")
    .select("round,club_id,tick,change")
    .eq("league_id", data.league.id)
    .eq("round", round);
  if (error) return data;
  return { ...data, changes: [...data.changes.filter((c) => c.round !== round), ...((rows ?? []) as ChangeRow[])] };
}

export async function sendChange(data: LeagueData, round: number, clubId: string, tick: number, change: string) {
  const { error } = await supabase().from("match_changes").insert({ league_id: data.league.id, round, club_id: clubId, tick, change });
  return !error;
}

/* ------------------------------------------------------------------ */
/* Times                                                               */
/* ------------------------------------------------------------------ */

const squadCache = new Map<string, BaseCard[]>();

function clubSquad(c: LeagueClub): BaseCard[] {
  const key = `${c.id}:${c.squad}`;
  let s = squadCache.get(key);
  if (!s) {
    s = squadCards(c.id, c.squad) ?? [];
    squadCache.set(key, s);
  }
  return s;
}

/** Quem joga na vaga `slot` na rodada `round` (técnico se já tinha assumido, senão CPU). */
export function teamAt(data: LeagueData, slot: number, round: number): TeamView {
  const club = data.clubs.find((c) => c.league_slot === slot && c.joined_round <= round);
  if (club) {
    return { slot, name: club.name, tag: club.tag, crest: decodeCrest(club.crest), kit: decodeKit(club.kit), bot: false, clubId: club.id, squad: clubSquad(club) };
  }
  const b = botTeam(data.league.id, slot);
  return { slot, name: b.name, tag: b.tag, crest: b.crest, kit: b.kit, bot: true, squad: b.squad };
}

/** Time "atual" da vaga (para a tabela): quem ocupa hoje. */
export function teamNow(data: LeagueData, slot: number): TeamView {
  const club = data.clubs.find((c) => c.league_slot === slot);
  return club ? teamAt(data, slot, Math.max(club.joined_round, 1)) : teamAt(data, slot, 1);
}

function lineupAt(data: LeagueData, team: TeamView, kickoff: number): Lineup {
  if (team.bot || !team.clubId) return botTeam(data.league.id, team.slot).lineup;
  let code: string | null = null;
  for (const l of data.logs) {
    if (l.club_id !== team.clubId) continue;
    if (new Date(l.at).getTime() <= kickoff) code = l.lineup;
  }
  return lineupFor(code, team.squad);
}

function toChanges(rows: ChangeRow[], round: number, clubId: string | undefined, side: 0 | 1): Change[] {
  if (!clubId) return [];
  return rows
    .filter((c) => c.round === round && c.club_id === clubId)
    .map((c): Change => {
      const k = c.change[0];
      if (k === "x") return { minute: c.tick, team: side, kind: "sub", out: parseInt(c.change[1], 36), in: parseInt(c.change[2], 36) };
      const v = Number(c.change.slice(1));
      return { minute: c.tick, team: side, kind: "tactic", ...(k === "p" ? { posture: v } : k === "m" ? { marking: v } : { passing: v }) };
    });
}

/* ------------------------------------------------------------------ */
/* Partidas                                                            */
/* ------------------------------------------------------------------ */

export type LeagueMatch = {
  round: number;
  index: number;
  home: TeamView;
  away: TeamView;
  kickoff: number;
  homeLineup: Lineup;
  awayLineup: Lineup;
  result: MatchResult;
};

const resultCache = new WeakMap<LeagueData, Map<string, LeagueMatch>>();

export function matchAt(data: LeagueData, round: number, index: number): LeagueMatch {
  let cache = resultCache.get(data);
  if (!cache) {
    cache = new Map();
    resultCache.set(data, cache);
  }
  const key = `${round}:${index}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const f = data.fixtures[round - 1][index];
  const kickoff = data.kickoffs[round - 1];
  const home = teamAt(data, f.home, round);
  const away = teamAt(data, f.away, round);
  const homeLineup = lineupAt(data, home, kickoff);
  const awayLineup = lineupAt(data, away, kickoff);
  const input = (t: TeamView, lineup: Lineup): TeamInput => ({ name: t.name, short: t.tag, squad: t.squad, lineup, ai: true });
  const result = simulate({
    seed: hash32(`liga:${data.league.id}:r${round}:${f.home}-${f.away}`),
    home: input(home, homeLineup),
    away: input(away, awayLineup),
    changes: [...toChanges(data.changes, round, home.clubId, 0), ...toChanges(data.changes, round, away.clubId, 1)],
  });
  const m = { round, index, home, away, kickoff, homeLineup, awayLineup, result };
  cache.set(key, m);
  return m;
}

/* ------------------------------------------------------------------ */
/* Relógio da liga                                                     */
/* ------------------------------------------------------------------ */

export type Clock = {
  /** rodada em andamento (1..N) ou null */
  live: number | null;
  /** tick atual da rodada ao vivo */
  tick: number;
  /** rodadas já encerradas (todas as < essa estão completas) */
  finished: number;
  /** próxima rodada a começar (1..N) ou null se acabou */
  next: number | null;
  ended: boolean;
};

/** Duração máxima de um jogo em ticks (90 + acréscimos máximos). */
export const MAX_TICKS = 98;

export function clockAt(data: LeagueData, now: number): Clock {
  let finished = 0;
  let live: number | null = null;
  let tick = 0;
  let next: number | null = null;
  data.kickoffs.forEach((k, i) => {
    const round = i + 1;
    const t = Math.floor((now - k) / (TICK_SECONDS * 1000));
    if (t < 0) {
      if (next === null) next = round;
    } else if (t > MAX_TICKS) {
      finished = round;
    } else {
      live = round;
      tick = t;
    }
  });
  return { live, tick, finished, next, ended: finished === data.kickoffs.length };
}

/** Um jogo específico terminou? (cada jogo tem duração própria de 93–98 ticks) */
export function matchDone(m: LeagueMatch, now: number) {
  return now >= m.kickoff + m.result.length * TICK_SECONDS * 1000;
}

/* ------------------------------------------------------------------ */
/* Tabela                                                              */
/* ------------------------------------------------------------------ */

export type Row = {
  slot: number;
  team: TeamView;
  p: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  form: ("V" | "E" | "D")[];
};

/** Tabela considerando todos os jogos já terminados até `now`. */
export function standings(data: LeagueData, now: number): Row[] {
  const rows: Row[] = Array.from({ length: data.league.size }, (_, slot) => ({
    slot,
    team: teamNow(data, slot),
    p: 0,
    j: 0,
    v: 0,
    e: 0,
    d: 0,
    gp: 0,
    gc: 0,
    form: [],
  }));
  for (let r = 1; r <= data.kickoffs.length; r++) {
    if (data.kickoffs[r - 1] > now) break;
    data.fixtures[r - 1].forEach((_, i) => {
      const m = matchAt(data, r, i);
      if (!matchDone(m, now)) return;
      const [h, a] = m.result.score;
      const H = rows[m.home.slot];
      const A = rows[m.away.slot];
      H.j++;
      A.j++;
      H.gp += h;
      H.gc += a;
      A.gp += a;
      A.gc += h;
      if (h > a) {
        H.v++;
        H.p += 3;
        A.d++;
        H.form.push("V");
        A.form.push("D");
      } else if (h < a) {
        A.v++;
        A.p += 3;
        H.d++;
        H.form.push("D");
        A.form.push("V");
      } else {
        H.e++;
        A.e++;
        H.p++;
        A.p++;
        H.form.push("E");
        A.form.push("E");
      }
    });
  }
  return rows.sort((x, y) => y.p - x.p || y.v - x.v || y.gp - y.gc - (x.gp - x.gc) || y.gp - x.gp || x.team.name.localeCompare(y.team.name));
}

/** Formatação de horário (Brasília) para a interface. */
export function fmtKickoff(ms: number, withDay = true) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  if (!withDay) return time;
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const tomorrow = new Date(Date.now() + 86400_000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const day = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const label = day === today ? "Hoje" : day === tomorrow ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${label}, ${time}`;
}

export function fmtCountdown(ms: number) {
  if (ms <= 0) return "agora";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m}min ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
