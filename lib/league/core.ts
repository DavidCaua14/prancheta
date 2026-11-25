/**
 * Núcleo da liga: monta os times, calcula os jogos e a tabela.
 * Código puro (sem banco, sem navegador) — roda igual no aparelho e na
 * Edge Function que fecha a temporada (supabase/functions/close-league).
 */
import type { BaseCard } from "@/lib/cards/generate";
import { hash32 } from "@/lib/cards/generate";
import { wonAt, type WonLot } from "@/lib/auction/lots";
import { matchXp } from "@/lib/cards/evolution";
import { clubCards } from "@/lib/cards/squad";
import { decodeCrest, decodeKit, type Crest, type Kit } from "@/lib/club/identity";
import { simulate, type Change, type MatchResult, type TeamInput } from "@/lib/sim/engine";
import { lineupFor, type Lineup } from "@/lib/tactics/lineup";
import { botTeam } from "./bots";
import { doubleRoundRobin, type Fixture } from "./schedule";

/** 1 minuto de jogo = 6 segundos (o mesmo valor está no banco: match_change_ok). */
export const TICK_SECONDS = 6;

export type LeagueRow = {
  id: number;
  division: number;
  size: number;
  rounds: number;
  starts_at: string;
  ends_at: string;
  closed_at: string | null;
  final: string | null;
};
export type LeagueClub = {
  id: string;
  name: string;
  tag: string;
  crest: string;
  kit: string;
  squad: string;
  league_slot: number;
  joined_round: number;
  /** XP acumulado por carta (null = tudo no nível 1) */
  xp: number[] | null;
  /** lotes do leilão arrematados (lidos à parte, em auction_lots) */
  won?: WonLot[];
};
export type LotRow = WonLot & { best_club: string };
export const LOT_COLS = "round,idx,ends_at,best_club";
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

/** Colunas lidas do banco (as mesmas no aparelho e no servidor). */
export const LEAGUE_COLS = "id,division,size,rounds,starts_at,ends_at,closed_at,final";
export const CLUB_COLS = "id,name,tag,crest,kit,squad,league_slot,joined_round,xp";

/** Escalações valem a partir de 11 dias antes do início (o banco guarda 10 + a última anterior). */
export function logsSince(league: LeagueRow) {
  return new Date(new Date(league.starts_at).getTime() - 11 * 86400_000).toISOString();
}

export function buildLeagueData(raw: {
  league: LeagueRow;
  rounds: { round: number; kickoff: string }[];
  clubs: LeagueClub[];
  logs: LogRow[];
  changes: ChangeRow[];
  /** lotes do leilão já encerrados, de qualquer clube da liga */
  lots?: LotRow[];
}): LeagueData {
  const rounds = [...raw.rounds].sort((a, b) => a.round - b.round);
  const logs = [...raw.logs].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return {
    league: raw.league,
    kickoffs: rounds.map((r) => new Date(r.kickoff).getTime()),
    clubs: raw.lots?.length ? raw.clubs.map((c) => ({ ...c, won: raw.lots!.filter((l) => l.best_club === c.id) })) : raw.clubs,
    logs,
    changes: raw.changes,
    fixtures: doubleRoundRobin(raw.league.size),
    loadedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Times                                                               */
/* ------------------------------------------------------------------ */

const squadCache = new Map<string, BaseCard[]>();

/** Elenco do clube no apito (cartas do leilão só contam depois de arrematadas). */
function clubSquad(c: LeagueClub, at: number): BaseCard[] {
  const won = wonAt(c.won, at);
  const key = `${c.id}:${c.squad}:${c.xp?.join(".") ?? ""}:${won.map((w) => `${w.round}-${w.idx}`).join(",")}`;
  let s = squadCache.get(key);
  if (!s) {
    s = clubCards(c.id, c.squad, c.xp, won);
    squadCache.set(key, s);
  }
  return s;
}

/** Quem joga na vaga `slot` na rodada `round` (técnico se já tinha assumido, senão CPU). */
export function teamAt(data: LeagueData, slot: number, round: number): TeamView {
  const club = data.clubs.find((c) => c.league_slot === slot && c.joined_round <= round);
  if (club) {
    return { slot, name: club.name, tag: club.tag, crest: decodeCrest(club.crest), kit: decodeKit(club.kit), bot: false, clubId: club.id, squad: clubSquad(club, data.kickoffs[round - 1] ?? Number.POSITIVE_INFINITY) };
  }
  const b = botTeam(data.league.id, slot, data.league.division);
  return { slot, name: b.name, tag: b.tag, crest: b.crest, kit: b.kit, bot: true, squad: b.squad };
}

/** Time "atual" da vaga (para a tabela): quem ocupa hoje. */
export function teamNow(data: LeagueData, slot: number): TeamView {
  const club = data.clubs.find((c) => c.league_slot === slot);
  return club ? teamAt(data, slot, Math.max(club.joined_round, 1)) : teamAt(data, slot, 1);
}

function lineupAt(data: LeagueData, team: TeamView, kickoff: number): Lineup {
  if (team.bot || !team.clubId) return botTeam(data.league.id, team.slot, data.league.division).lineup;
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
      if (k === "y") return { minute: c.tick, team: side, kind: "sub", out: parseInt(c.change.slice(1, 3), 36), in: parseInt(c.change.slice(3, 5), 36) };
      const v = Number(c.change.slice(1));
      const field = { p: "posture", m: "marking", s: "passing", l: "line", w: "width", t: "tempo" }[k] ?? "passing";
      return { minute: c.tick, team: side, kind: "tactic", [field]: v };
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
  return rows.sort((x, y) => y.p - x.p || y.v - x.v || y.gp - y.gc - (x.gp - x.gc) || y.gp - x.gp || x.slot - y.slot);
}

/**
 * XP que as cartas do clube ganharam nos jogos da liga terminados até `now`
 * (só os jogos em que o próprio técnico comandou a vaga). O servidor usa
 * now = ∞ no fechamento; o aparelho usa para mostrar o "XP a receber".
 */
export function clubMatchXp(data: LeagueData, clubId: string, now: number): { xp: number[]; games: number } {
  // uma posição por carta do elenco (14 da peneira + as do leilão, sem limite)
  const total: number[] = Array.from({ length: 14 }, () => 0);
  let games = 0;
  for (let r = 1; r <= data.kickoffs.length; r++) {
    if (data.kickoffs[r - 1] > now) break;
    const fixtures = data.fixtures[r - 1];
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      const home = teamAt(data, f.home, r);
      const away = teamAt(data, f.away, r);
      const side = home.clubId === clubId ? 0 : away.clubId === clubId ? 1 : -1;
      if (side < 0) continue;
      const m = matchAt(data, r, i);
      if (!matchDone(m, now)) break;
      const xi = side === 0 ? m.homeLineup.xi : m.awayLineup.xi;
      const squad = side === 0 ? m.home.squad : m.away.squad;
      matchXp(m.result, side as 0 | 1, xi, squad.length).forEach((v, k) => (total[k] = (total[k] ?? 0) + v));
      games++;
      break;
    }
  }
  return { xp: total, games };
}

/** Números de um clube num conjunto de jogos (alimentam as missões dos eventos). */
export type MatchStats = { games: number; wins: number; draws: number; goals_for: number; goals_against: number; clean_sheets: number; big_wins: number };

export function emptyStats(): MatchStats {
  return { games: 0, wins: 0, draws: 0, goals_for: 0, goals_against: 0, clean_sheets: 0, big_wins: 0 };
}

/** Soma um jogo (gols a favor / contra) nas estatísticas. */
export function addGame(s: MatchStats, gf: number, ga: number) {
  s.games++;
  s.goals_for += gf;
  s.goals_against += ga;
  if (gf > ga) s.wins++;
  else if (gf === ga) s.draws++;
  if (ga === 0) s.clean_sheets++;
  if (gf - ga >= 3) s.big_wins++;
}

/** Estatísticas do clube nos jogos da liga terminados até `now` (só os que o próprio técnico comandou). */
export function clubLeagueStats(data: LeagueData, clubId: string, now: number): MatchStats {
  const st = emptyStats();
  for (let r = 1; r <= data.kickoffs.length; r++) {
    if (data.kickoffs[r - 1] > now) break;
    const fixtures = data.fixtures[r - 1];
    for (let i = 0; i < fixtures.length; i++) {
      const home = teamAt(data, fixtures[i].home, r);
      const away = teamAt(data, fixtures[i].away, r);
      const side = home.clubId === clubId ? 0 : away.clubId === clubId ? 1 : -1;
      if (side < 0) continue;
      const m = matchAt(data, r, i);
      if (!matchDone(m, now)) break;
      const [h, a] = m.result.score;
      addGame(st, side === 0 ? h : a, side === 0 ? a : h);
      break;
    }
  }
  return st;
}

/** Tabela final (todos os jogos da temporada). */
export function finalTable(data: LeagueData): Row[] {
  return standings(data, Number.POSITIVE_INFINITY);
}

/** Ordem final das vagas em base 36 ("3017..."), como o banco guarda em leagues.final. */
export function finalCode(rows: Row[]) {
  return rows.map((r) => r.slot.toString(36)).join("");
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
