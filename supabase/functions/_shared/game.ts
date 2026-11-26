/**
 * Acesso ao banco (service_role) e carga dos dados de jogo, compartilhados
 * pelas Edge Functions (close-league, close-cup, score-round).
 */
import { buildCupData, CUP_COLS, CUP_ROUND_GAP_MS, ENTRY_COLS, type CupData, type CupEntry, type CupRow } from "../../../lib/cup/core";
import { buildLeagueData, CLUB_COLS, LEAGUE_COLS, LOT_COLS, logsFrom, type LeagueClub, type LeagueData, type LeagueRow, type LotRow } from "../../../lib/league/core";
import { cupRoundPoints, leagueRoundPoints, MATCH_SETTLE_MS, type RoundPoints } from "../../../lib/scoring";

declare const Deno: { env: { get(k: string): string | undefined } };

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function loadLeagueRow(id: number) {
  return (await rest<LeagueRow[]>(`leagues?id=eq.${id}&select=${LEAGUE_COLS}`))[0] ?? null;
}

/** Liga inteira, como os aparelhos montam (mesmo código do jogo). */
export async function loadLeagueData(league: LeagueRow): Promise<{ data: LeagueData; clubs: LeagueClub[] }> {
  const id = league.id;
  const [rounds, clubs, changes] = await Promise.all([
    rest<{ round: number; kickoff: string }[]>(`league_rounds?league_id=eq.${id}&select=round,kickoff&order=round`),
    rest<LeagueClub[]>(`clubs?league_id=eq.${id}&select=${CLUB_COLS}`),
    rest<{ round: number; club_id: string; tick: number; change: string }[]>(`match_changes?league_id=eq.${id}&select=round,club_id,tick,change`),
  ]);
  const ids = clubs.map((c) => c.id);
  const logs = ids.length
    ? await rest<{ club_id: string; at: string; lineup: string }[]>("rpc/lineup_log_window", {
        method: "POST",
        body: JSON.stringify({ p_clubs: ids, p_from: logsFrom(league) }),
      })
    : [];
  const lots = ids.length
    ? await rest<LotRow[]>(`auction_lots?best_club=in.(${ids.join(",")})&ends_at=lt.${encodeURIComponent(new Date().toISOString())}&select=${LOT_COLS}`)
    : [];
  return { data: buildLeagueData({ league, rounds, clubs, logs, changes, lots }), clubs };
}

export async function loadCupRow(id: number) {
  return (await rest<CupRow[]>(`cups?id=eq.${id}&select=${CUP_COLS}`))[0] ?? null;
}

export async function loadCupData(cup: CupRow, lotsUntil: string): Promise<{ data: CupData; entries: CupEntry[] }> {
  const id = cup.id;
  const [entries, changes] = await Promise.all([
    rest<CupEntry[]>(`cup_entries?cup_id=eq.${id}&select=${encodeURIComponent(ENTRY_COLS)}`),
    rest<{ round: number; club_id: string; tick: number; change: string }[]>(`cup_changes?cup_id=eq.${id}&select=round,club_id,tick,change`),
  ]);
  const ids = entries.map((e) => e.club_id);
  const [logs, lots] = ids.length
    ? await Promise.all([
        rest<{ club_id: string; at: string; lineup: string }[]>("rpc/lineup_log_window", { method: "POST", body: JSON.stringify({ p_clubs: ids, p_from: cup.starts_at }) }),
        rest<LotRow[]>(`auction_lots?best_club=in.(${ids.join(",")})&ends_at=lt.${encodeURIComponent(lotsUntil)}&select=${LOT_COLS}`),
      ])
    : [[], []];
  return { data: buildCupData({ cup, entries, logs, changes, lots }), entries };
}

type RoundRows = { round: number; played_at: string; rows: RoundPoints[] };

/** Grava no ranking as rodadas encerradas ainda não gravadas (idempotente). */
export async function recordLeagueRounds(data: LeagueData, onlyRound?: number) {
  const done = new Set(await rest<number[]>("rpc/scored", { method: "POST", body: JSON.stringify({ p_kind: 0, p_ref: data.league.id }) }));
  const now = Date.now();
  const list: RoundRows[] = [];
  data.kickoffs.forEach((k, i) => {
    const r = i + 1;
    if (done.has(r) || (onlyRound !== undefined && r !== onlyRound) || now < k + MATCH_SETTLE_MS) return;
    list.push({ round: r, played_at: new Date(k).toISOString(), rows: leagueRoundPoints(data, r) });
  });
  if (!list.length) return 0;
  return rest<number>("rpc/record_rounds", { method: "POST", body: JSON.stringify({ p_kind: 0, p_ref: data.league.id, p_tier: data.league.division, p_rounds: list }) });
}

export async function recordCupRounds(data: CupData, onlyRound?: number) {
  const done = new Set(await rest<number[]>("rpc/scored", { method: "POST", body: JSON.stringify({ p_kind: 1, p_ref: data.cup.id }) }));
  const now = Date.now();
  const start = new Date(data.cup.starts_at).getTime();
  const list: RoundRows[] = [];
  data.kickoffs.forEach((_, i) => {
    const r = i + 1;
    const k = start + i * CUP_ROUND_GAP_MS;
    if (done.has(r) || (onlyRound !== undefined && r !== onlyRound) || now < k + MATCH_SETTLE_MS) return;
    list.push({ round: r, played_at: new Date(k).toISOString(), rows: cupRoundPoints(data, r) });
  });
  if (!list.length) return 0;
  return rest<number>("rpc/record_rounds", { method: "POST", body: JSON.stringify({ p_kind: 1, p_ref: data.cup.id, p_tier: data.cup.kind, p_rounds: list }) });
}
