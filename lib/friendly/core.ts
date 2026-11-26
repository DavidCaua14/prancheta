/**
 * Amistosos entre amigos: cálculo puro (roda igual nos dois aparelhos).
 *
 * Quem marcou é o mandante. O jogo usa a escalação salva de cada clube no
 * apito, a força (XP) congelada no aceite, as cartas do leilão arrematadas
 * até o apito e as mudanças ao vivo dos dois técnicos. Empate é empate.
 * Não dá moedas, XP nem conta nos eventos.
 */
import { serverNow } from "@/lib/time";
import { wonAt } from "@/lib/auction/lots";
import { hash32, type BaseCard } from "@/lib/cards/generate";
import { clubCards } from "@/lib/cards/squad";
import { decodeCrest, decodeKit } from "@/lib/club/identity";
import { toChanges } from "@/lib/cup/core";
import { TICK_SECONDS, type ChangeRow, type LeagueMatch, type LogRow, type LotRow, type TeamView } from "@/lib/league/core";
import { simulate, type TeamInput } from "@/lib/sim/engine";
import { lineupFor, type Lineup } from "@/lib/tactics/lineup";

/** Convite aberto sem login: volta para ele depois de entrar e montar o clube. */
export const PENDING_INVITE = "prancheta:convite";

export const FRIENDLY_COLS = "id,code,host,guest,kickoff,host_xp,guest_xp,accepted_at";

/** Antecedência mínima e máxima para marcar (espelho de create_friendly). */
export const MIN_AHEAD_MS = 2 * 60_000;
export const MAX_AHEAD_MS = 7 * 86400_000;
/** Aceite até 30 s antes do apito (espelho de accept_friendly). */
export const ACCEPT_UNTIL_MS = 30_000;
/** Amistosos por jogar, por clube (espelho de create_friendly). */
export const MAX_OPEN = 5;

export type FriendlyRow = {
  id: number;
  code: string;
  host: string;
  guest: string | null;
  kickoff: string;
  host_xp: number[] | null;
  guest_xp: number[] | null;
  accepted_at: string | null;
};

export type FriendlyClub = { id: string; name: string; tag: string; crest: string; kit: string; squad: string | null };

export type FriendlyData = {
  f: FriendlyRow;
  clubs: Record<string, FriendlyClub>;
  logs: LogRow[];
  lots: LotRow[];
  /** mudanças ao vivo (round = 1 para caber na tela da liga) */
  changes: ChangeRow[];
  kickoff: number;
  loadedAt: number;
};

/** Situação do amistoso para a lista e para o convite. */
export type FriendlyState = "waiting" | "expired" | "scheduled" | "live" | "done";

/** Duração máxima de um jogo na tela (90 + acréscimos, 6 s por minuto). */
export const FRIENDLY_MATCH_MS = 100 * TICK_SECONDS * 1000;

export function friendlyState(f: Pick<FriendlyRow, "guest" | "kickoff">, now: number, length?: number): FriendlyState {
  const k = new Date(f.kickoff).getTime();
  if (!f.guest) return now < k - ACCEPT_UNTIL_MS ? "waiting" : "expired";
  if (now < k) return "scheduled";
  const end = k + (length ?? 100) * TICK_SECONDS * 1000;
  return now < end ? "live" : "done";
}

const squadCache = new Map<string, BaseCard[]>();

function team(data: FriendlyData, side: 0 | 1): TeamView {
  const id = side === 0 ? data.f.host : data.f.guest!;
  const c = data.clubs[id];
  const xp = side === 0 ? data.f.host_xp : data.f.guest_xp;
  const won = wonAt(data.lots.filter((l) => l.best_club === id), data.kickoff);
  const key = `${id}:${c?.squad}:${xp?.join(".") ?? ""}:${won.map((w) => `${w.round}-${w.idx}`).join(",")}`;
  let squad = squadCache.get(key);
  if (!squad) {
    squad = clubCards(id, c?.squad ?? null, xp, won);
    squadCache.set(key, squad);
  }
  return {
    slot: side,
    name: c?.name ?? "Clube",
    tag: c?.tag ?? "???",
    crest: decodeCrest(c?.crest ?? ""),
    kit: decodeKit(c?.kit ?? ""),
    bot: false,
    clubId: id,
    squad,
  };
}

function lineupAt(data: FriendlyData, t: TeamView): Lineup {
  let code: string | null = null;
  for (const l of data.logs) {
    if (l.club_id !== t.clubId) continue;
    if (new Date(l.at).getTime() <= data.kickoff) code = l.lineup;
  }
  return lineupFor(code, t.squad);
}

export function buildFriendlyData(raw: { f: FriendlyRow; clubs: FriendlyClub[]; logs: LogRow[]; lots: LotRow[]; changes: { club_id: string; tick: number; change: string }[] }): FriendlyData {
  return {
    f: raw.f,
    clubs: Object.fromEntries(raw.clubs.map((c) => [c.id, c])),
    logs: [...raw.logs].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    lots: raw.lots,
    changes: raw.changes.map((c) => ({ round: 1, club_id: c.club_id, tick: c.tick, change: c.change })),
    kickoff: new Date(raw.f.kickoff).getTime(),
    loadedAt: serverNow(),
  };
}

const cache = new WeakMap<FriendlyData, LeagueMatch>();

/** O jogo (só existe depois do aceite). Quem marcou joga em casa. */
export function friendlyMatch(data: FriendlyData): LeagueMatch {
  const hit = cache.get(data);
  if (hit) return hit;
  if (!data.f.guest) throw new Error("amistoso sem adversário");
  const home = team(data, 0);
  const away = team(data, 1);
  const homeLineup = lineupAt(data, home);
  const awayLineup = lineupAt(data, away);
  const input = (t: TeamView, lineup: Lineup): TeamInput => ({ name: t.name, short: t.tag, squad: t.squad, lineup, ai: true });
  const result = simulate({
    seed: hash32(`amistoso:${data.f.id}`),
    home: input(home, homeLineup),
    away: input(away, awayLineup),
    changes: [...toChanges(data.changes, 1, home.clubId, 0), ...toChanges(data.changes, 1, away.clubId, 1)],
  });
  const m: LeagueMatch = { round: 1, index: 0, home, away, kickoff: data.kickoff, homeLineup, awayLineup, result };
  cache.set(data, m);
  return m;
}

/** Link do convite (o código vai na URL; a página é estática). */
export function inviteLink(origin: string, code: string) {
  return `${origin}/amistosos?c=${encodeURIComponent(code)}`;
}

/** Texto pronto para o grupo. */
export function inviteText(clubName: string, kickoffLabel: string, link: string) {
  return `⚽ Amistoso na Prancheta! O ${clubName} te desafia — ${kickoffLabel}. Aceita? ${link}`;
}
