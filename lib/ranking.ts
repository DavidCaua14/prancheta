"use client";

/** Ranking entre técnicos (só clubes reais). Regras: 0028_ranking.sql. */
import { supabase } from "@/lib/supabase/client";

export type RankRow = {
  pos: number;
  club_id: string;
  name: string;
  tag: string;
  crest: string;
  division: number;
  score: number;
  /** vitórias na liga + fases vencidas nas copas */
  wins: number;
  titles: number;
  cup_titles: number;
  seasons: number;
  me: boolean;
};

/** Pontos base (× divisão na liga, × copa nas copas). Espelho de 0029_ranking_wins.sql. */
export const RANK_POINTS = { win: 10, draw: 3, bigWin: 5, title: 150, promotion: 75, cupRound: 15, cupChampion: 60 } as const;

/** Multiplicadores (espelho de division_mult / cup_mult). */
export const DIVISION_MULT = [1, 1.25, 1.5, 2, 2.5, 3] as const;
export const CUP_MULT = [1, 1.5, 2, 3] as const;

export async function loadRanking(week: boolean, limit = 50): Promise<RankRow[]> {
  const { data, error } = await supabase().rpc("ranking", { p_week: week, p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as RankRow[]).map((r) => ({ ...r, pos: Number(r.pos) }));
}
