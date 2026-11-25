/**
 * Núcleo das copas: chaveamento, jogos e quem avança. Código puro — roda
 * igual no aparelho e na Edge Function close-cup (que confirma o resultado
 * e paga os prêmios).
 *
 * Mata-mata de jogo único, campo neutro, empate vai para os pênaltis.
 * 1ª fase: vaga 0 × 1, 2 × 3, ... (as vagas são sorteadas na inscrição).
 * Fases seguintes: vencedor do jogo 2i × vencedor do jogo 2i+1.
 */
import { wonAt, type WonLot } from "@/lib/auction/lots";
import { hash32, rng, type BaseCard } from "@/lib/cards/generate";
import { LENDAS_CLUBS, SERIE_A_CLUBS, SERIE_B_CLUBS, SERIE_C_CLUBS, SERIE_D_CLUBS, VARZEA_CLUBS } from "@/lib/cards/names";
import { clubCards } from "@/lib/cards/squad";
import { decodeCrest, decodeKit } from "@/lib/club/identity";
import { botTeam, tagOf } from "@/lib/league/bots";
import { addGame, emptyStats, type ChangeRow, type LogRow, type LotRow, type MatchStats, type TeamView } from "@/lib/league/core";
import { simulate, type Change, type MatchResult, type TeamInput } from "@/lib/sim/engine";
import { lineupFor, type Lineup } from "@/lib/tactics/lineup";
import { shootout, type Shootout } from "./shootout";

export type CupConfig = {
  id: string;
  name: string;
  art: string;
  size: number;
  /** horário (Brasília, em minutos desde 0h) da 1ª fase; uma fase a cada 2 h */
  firstMinute: number;
  /** inscrições fecham 15 min antes da 1ª fase */
  deadlineMinute: number;
  /** divisão mínima para se inscrever (0 = Várzea, 2 = Série C) */
  minDivision: number;
  /** divisão da CPU que completa a chave */
  botDivision: number;
  /** nomes dos times da CPU (sem repetir na chave) */
  botNames: readonly string[];
  /** moedas por fase alcançada: 0 = caiu na 1ª fase ... última = campeão (espelho de cup_prize) */
  prizes: readonly number[];
  tagline: string;
  /** dia da semana da edição (0 = domingo); ausente = todo dia */
  weekday?: number;
  /** só para campeões de divisão (1º lugar numa temporada encerrada nos últimos 7 dias) */
  requiresTitle?: boolean;
};

/** Validade do título de divisão para entrar na Supercopa (espelho de join_cup). */
export const TITLE_VALID_DAYS = 7;

/** Copas do jogo (a chave é cups.kind no banco; espelho de cup_config() no SQL). */
export const CUP_KINDS: Record<number, CupConfig> = {
  0: {
    id: "copa-varzea",
    name: "Copa da Várzea",
    art: "trophy-copa-varzea",
    size: 32,
    firstMinute: 13 * 60,
    deadlineMinute: 12 * 60 + 45,
    minDivision: 0,
    botDivision: 0,
    botNames: [...VARZEA_CLUBS, ...SERIE_D_CLUBS],
    prizes: [0, 100, 200, 400, 800, 1500],
    tagline: "Mata-mata diário · 32 clubes · aberta a todos",
  },
  1: {
    id: "copa-nacional",
    name: "Copa Nacional",
    art: "trophy-copa-nacional",
    size: 64,
    firstMinute: 11 * 60 + 30,
    deadlineMinute: 11 * 60 + 15,
    minDivision: 2,
    botDivision: 2,
    botNames: [...SERIE_C_CLUBS, ...SERIE_B_CLUBS, ...SERIE_D_CLUBS],
    prizes: [0, 100, 200, 400, 800, 2000, 4000],
    tagline: "Mata-mata diário · 64 clubes · a partir da Série C",
  },
  2: {
    id: "supercopa",
    name: "Supercopa",
    art: "trophy-supercopa",
    size: 16,
    firstMinute: 14 * 60 + 30,
    deadlineMinute: 14 * 60 + 15,
    minDivision: 0,
    botDivision: 3,
    botNames: [...SERIE_A_CLUBS, ...LENDAS_CLUBS],
    prizes: [500, 1000, 1800, 3000, 6000],
    tagline: "Todo domingo · 16 campeões de divisão",
    weekday: 0,
    requiresTitle: true,
  },
};
export type CupKind = number;

export function cupConfig(kind: number): CupConfig {
  return CUP_KINDS[kind] ?? CUP_KINDS[0];
}

/** Nome do time da CPU na vaga: lista própria da copa, embaralhada por edição, sem repetir. */
function botName(cup: CupRow, slot: number) {
  const pool = [...cupConfig(cup.kind).botNames];
  const r = rng(hash32(`copa:${cup.id}:nomes`));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool[slot % pool.length];
}

export const CUP_ROUND_GAP_MS = 2 * 3600_000;
export const CUP_COLS = "id,kind,size,starts_at,ends_at,closed_at,champion";
export const ENTRY_COLS = "slot,club_id,xp,reach,coins,clubs(name,tag,crest,kit,squad)";

export type CupRow = { id: number; kind: number; size: number; starts_at: string; ends_at: string; closed_at: string | null; champion: number | null };
export type CupEntry = {
  slot: number;
  club_id: string;
  /** XP das cartas na inscrição (a força fica congelada durante a copa) */
  xp: number[] | null;
  reach: number | null;
  coins: number | null;
  clubs: { name: string; tag: string; crest: string; kit: string; squad: string } | null;
};

export type CupData = {
  cup: CupRow;
  entries: CupEntry[];
  logs: LogRow[];
  changes: ChangeRow[];
  lots: LotRow[];
  kickoffs: number[];
  loadedAt: number;
};

export function roundsOf(size: number) {
  return Math.round(Math.log2(size));
}

export function roundName(round: number, total: number) {
  const left = total - round;
  return left === 0 ? "Final" : left === 1 ? "Semifinal" : left === 2 ? "Quartas" : left === 3 ? "Oitavas" : `${round}ª fase`;
}

export function buildCupData(raw: { cup: CupRow; entries: CupEntry[]; logs: LogRow[]; changes: ChangeRow[]; lots?: LotRow[] }): CupData {
  const start = new Date(raw.cup.starts_at).getTime();
  return {
    cup: raw.cup,
    entries: raw.entries,
    logs: [...raw.logs].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    changes: raw.changes,
    lots: raw.lots ?? [],
    kickoffs: Array.from({ length: roundsOf(raw.cup.size) }, (_, i) => start + i * CUP_ROUND_GAP_MS),
    loadedAt: Date.now(),
  };
}

/* ------------------------------------------------------------- times */

const squadCache = new Map<string, BaseCard[]>();

export function cupTeam(data: CupData, slot: number, at: number): TeamView {
  const e = data.entries.find((x) => x.slot === slot);
  if (e?.clubs) {
    const won: WonLot[] = wonAt(data.lots.filter((l) => l.best_club === e.club_id), at);
    const key = `${e.club_id}:${e.clubs.squad}:${e.xp?.join(".") ?? ""}:${won.map((w) => `${w.round}-${w.idx}`).join(",")}`;
    let squad = squadCache.get(key);
    if (!squad) {
      squad = clubCards(e.club_id, e.clubs.squad, e.xp, won);
      squadCache.set(key, squad);
    }
    return { slot, name: e.clubs.name, tag: e.clubs.tag, crest: decodeCrest(e.clubs.crest), kit: decodeKit(e.clubs.kit), bot: false, clubId: e.club_id, squad };
  }
  const b = botTeam(1_000_000 + data.cup.id, slot, cupConfig(data.cup.kind).botDivision);
  const name = botName(data.cup, slot);
  return { slot, name, tag: tagOf(name), crest: b.crest, kit: b.kit, bot: true, squad: b.squad };
}

function lineupAt(data: CupData, team: TeamView, kickoff: number): Lineup {
  if (team.bot || !team.clubId) {
    return botTeam(1_000_000 + data.cup.id, team.slot, cupConfig(data.cup.kind).botDivision).lineup;
  }
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
      return { minute: c.tick, team: side, kind: "tactic", ...(k === "p" ? { posture: v } : k === "m" ? { marking: v } : { passing: v }) };
    });
}

/* ------------------------------------------------------------ jogos */

export type CupMatch = {
  round: number;
  index: number;
  home: TeamView;
  away: TeamView;
  kickoff: number;
  homeLineup: Lineup;
  awayLineup: Lineup;
  result: MatchResult;
  shootout: Shootout | null;
  /** 0 = mandante avança, 1 = visitante */
  winner: 0 | 1;
};

const cache = new WeakMap<CupData, Map<string, CupMatch>>();

/** Vagas (slots) que disputam a fase `round`, na ordem do chaveamento. */
export function slotsIn(data: CupData, round: number): number[] {
  if (round === 1) return Array.from({ length: data.cup.size }, (_, s) => s);
  const prev = slotsIn(data, round - 1);
  return Array.from({ length: prev.length / 2 }, (_, i) => {
    const m = cupMatch(data, round - 1, i);
    return m.winner === 0 ? m.home.slot : m.away.slot;
  });
}

export function cupMatch(data: CupData, round: number, index: number): CupMatch {
  let c = cache.get(data);
  if (!c) {
    c = new Map();
    cache.set(data, c);
  }
  const k = `${round}:${index}`;
  const hit = c.get(k);
  if (hit) return hit;
  const slots = slotsIn(data, round);
  const kickoff = data.kickoffs[round - 1];
  const home = cupTeam(data, slots[index * 2], kickoff);
  const away = cupTeam(data, slots[index * 2 + 1], kickoff);
  const homeLineup = lineupAt(data, home, kickoff);
  const awayLineup = lineupAt(data, away, kickoff);
  const input = (t: TeamView, lineup: Lineup): TeamInput => ({ name: t.name, short: t.tag, squad: t.squad, lineup, ai: true });
  const seed = hash32(`copa:${data.cup.id}:r${round}:${index}`);
  const result = simulate({
    seed,
    neutral: true,
    home: input(home, homeLineup),
    away: input(away, awayLineup),
    changes: [...toChanges(data.changes, round, home.clubId, 0), ...toChanges(data.changes, round, away.clubId, 1)],
  });
  const [h, a] = result.score;
  const so =
    h === a
      ? shootout(hash32(`copa:${data.cup.id}:r${round}:${index}:penaltis`), [{ squad: home.squad, lineup: homeLineup }, { squad: away.squad, lineup: awayLineup }], result.events)
      : null;
  const m: CupMatch = { round, index, home, away, kickoff, homeLineup, awayLineup, result, shootout: so, winner: so ? so.winner : h > a ? 0 : 1 };
  c.set(k, m);
  return m;
}

/** Fase alcançada por vaga: 0 = caiu na 1ª fase ... rounds = campeão. */
export function cupReach(data: CupData): number[] {
  const total = roundsOf(data.cup.size);
  const reach = Array.from({ length: data.cup.size }, () => 0);
  for (let r = 1; r <= total; r++) {
    const n = slotsIn(data, r).length / 2;
    for (let i = 0; i < n; i++) {
      const m = cupMatch(data, r, i);
      reach[m.winner === 0 ? m.home.slot : m.away.slot] = r;
    }
  }
  return reach;
}

/** Caminho de uma vaga: em que jogo de cada fase ela está (até cair). */
export function pathOf(data: CupData, slot: number): CupMatch[] {
  const out: CupMatch[] = [];
  const total = roundsOf(data.cup.size);
  for (let r = 1; r <= total; r++) {
    const slots = slotsIn(data, r);
    const k = slots.indexOf(slot);
    if (k < 0) break;
    out.push(cupMatch(data, r, Math.floor(k / 2)));
  }
  return out;
}

/**
 * Estatísticas de uma vaga na copa (jogos terminados até `now`). Pênaltis não
 * contam como gol nem vitória: o jogo conta como empate (como no futebol).
 */
export function cupStats(data: CupData, slot: number, now = Number.POSITIVE_INFINITY): MatchStats & { cup_wins: number } {
  const st = emptyStats();
  let cupWins = 0;
  for (const m of pathOf(data, slot)) {
    if (now < m.kickoff + m.result.length * 6000) break;
    const side = m.home.slot === slot ? 0 : 1;
    const [h, a] = m.result.score;
    addGame(st, side === 0 ? h : a, side === 0 ? a : h);
    if (m.winner === side) cupWins++;
  }
  return { ...st, cup_wins: cupWins };
}
