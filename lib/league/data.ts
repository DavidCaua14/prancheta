"use client";

/**
 * Leitura e escrita da liga no Supabase. O cálculo (jogos, tabela) está em
 * ./core — código puro, que também roda no servidor para fechar a temporada.
 */
import { supabase } from "@/lib/supabase/client";
import { buildLeagueData, CLUB_COLS, LEAGUE_COLS, LOT_COLS, logsSince, type ChangeRow, type LeagueData, type LeagueRow, type LogRow, type LeagueClub, type LotRow } from "./core";

export * from "./core";

export async function joinLeague(): Promise<number> {
  const { data, error } = await supabase().rpc("join_league");
  if (error) throw error;
  return data as number;
}

export async function loadLeague(leagueId: number): Promise<LeagueData> {
  const sb = supabase();
  const [lg, rounds, clubs, changes] = await Promise.all([
    sb.from("leagues").select(LEAGUE_COLS).eq("id", leagueId).single(),
    sb.from("league_rounds").select("round,kickoff").eq("league_id", leagueId).order("round"),
    sb.from("clubs").select(CLUB_COLS).eq("league_id", leagueId),
    sb.from("match_changes").select("round,club_id,tick,change").eq("league_id", leagueId),
  ]);
  if (lg.error) throw lg.error;
  if (rounds.error) throw rounds.error;
  if (clubs.error) throw clubs.error;
  const league = lg.data as LeagueRow;
  const ids = (clubs.data ?? []).map((c) => c.id);
  const logs = ids.length
    ? await sb.from("lineup_log").select("club_id,at,lineup").in("club_id", ids).gte("at", logsSince(league)).order("at")
    : { data: [], error: null };
  if (logs.error) throw logs.error;
  const lots = ids.length
    ? await sb.from("auction_lots").select(LOT_COLS).in("best_club", ids).lt("ends_at", new Date().toISOString())
    : { data: [], error: null };
  if (lots.error) throw lots.error;
  return buildLeagueData({
    lots: (lots.data ?? []) as LotRow[],
    league,
    rounds: rounds.data ?? [],
    clubs: (clubs.data ?? []) as LeagueClub[],
    logs: (logs.data ?? []) as LogRow[],
    changes: (changes.data ?? []) as ChangeRow[],
  });
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
/* Fim de temporada                                                    */
/* ------------------------------------------------------------------ */

export type SeasonRow = { league_id: number; division: number; pos: number; pts: number; move: number; coins: number };

/** Carta que subiu de nível no fechamento da temporada. */
export type Evolved = { name: string; position: string; from: number; to: number; overall: number; gain: number };
export type SeasonResult = SeasonRow & { evolved: Evolved[]; xp: number };

/**
 * Pede ao servidor para fechar a temporada (idempotente: se alguém já
 * fechou, só devolve o resultado). O servidor recalcula todos os jogos com o
 * mesmo motor — ninguém consegue "inventar" a própria classificação.
 */
export async function closeLeague(leagueId: number): Promise<boolean> {
  const { error } = await supabase().functions.invoke("close-league", { body: { league_id: leagueId } });
  return !error;
}

/** Última temporada encerrada do clube (para a tela de fim de temporada). */
export async function lastSeason(clubId: string): Promise<SeasonRow | null> {
  const { data, error } = await supabase()
    .from("club_seasons")
    .select("league_id,division,pos,pts,move,coins")
    .eq("club_id", clubId)
    .order("league_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as SeasonRow | null;
}
