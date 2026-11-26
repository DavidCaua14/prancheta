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

/** Resultado gravado de um jogo (match_points). */
export type MatchPointsRow = { kind: 0 | 1; tier: number; result: 0 | 1 | 2; gf: number; ga: number; big_win: boolean; advanced: boolean };

/** Pontos de um jogo no ranking, com a conta para mostrar (espelho de ranking() em 0030_match_points.sql). */
export function matchRankPoints(r: MatchPointsRow): { total: number; parts: { label: string; pts: number }[]; mult: number } {
  const parts: { label: string; pts: number }[] = [];
  if (r.kind === 0) {
    if (r.result === 2) parts.push({ label: "Vitória", pts: RANK_POINTS.win });
    else if (r.result === 1) parts.push({ label: "Empate", pts: RANK_POINTS.draw });
    if (r.big_win) parts.push({ label: "Goleada", pts: RANK_POINTS.bigWin });
  } else if (r.advanced) {
    parts.push({ label: "Passou de fase", pts: RANK_POINTS.cupRound });
  }
  const mult = r.kind === 0 ? DIVISION_MULT[Math.min(Math.max(r.tier, 0), 5)] : CUP_MULT[Math.min(Math.max(r.tier, 0), 3)];
  const base = parts.reduce((s, p) => s + p.pts, 0);
  return { total: Math.round(base * mult), parts, mult };
}

export async function loadMatchPoints(clubId: string, kind: 0 | 1, ref: number, round: number): Promise<MatchPointsRow | null> {
  const { data } = await supabase()
    .from("match_points")
    .select("kind,tier,result,gf,ga,big_win,advanced")
    .eq("club_id", clubId)
    .eq("kind", kind)
    .eq("ref_id", ref)
    .eq("round", round)
    .maybeSingle();
  return (data as MatchPointsRow | null) ?? null;
}

export type RankClimb = { before: number; after: number; passed: { name: string; tag: string; crest: string }[] };

/** Posição antes deste jogo × agora, e quem foi ultrapassado (rank_climb). */
export async function loadRankClimb(pts: number, win: boolean): Promise<RankClimb | null> {
  const { data, error } = await supabase().rpc("rank_climb", { p_pts: pts, p_win: win });
  if (error) return null;
  const r = ((data ?? []) as { before: number; after: number; passed: RankClimb["passed"] }[])[0];
  return r ? { before: Number(r.before), after: Number(r.after), passed: r.passed ?? [] } : null;
}
