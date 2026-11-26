/**
 * Pontos do ranking jogo a jogo: o resultado de cada técnico real numa
 * rodada da liga ou fase de copa. Código puro — a Edge Function score-round
 * (e o fechamento de liga/copa) calcula com ele e grava em match_points.
 */
import { cupMatch, roundsOf, slotsIn, type CupData } from "@/lib/cup/core";
import { matchAt, type LeagueData } from "@/lib/league/core";

/** Um jogo dura no máximo ~10 min (98 minutos de 6 s); só pontua depois disso. */
export const MATCH_SETTLE_MS = 10 * 60_000;

export type RoundPoints = {
  club_id: string;
  /** 2 vitória, 1 empate, 0 derrota (no tempo normal) */
  result: 0 | 1 | 2;
  gf: number;
  ga: number;
  /** vitória por 3+ gols */
  big_win: boolean;
  /** copa: passou de fase (inclui pênaltis) */
  advanced: boolean;
};

function outcome(gf: number, ga: number) {
  return { result: (gf > ga ? 2 : gf === ga ? 1 : 0) as 0 | 1 | 2, gf, ga, big_win: gf - ga >= 3 };
}

/** Resultados dos técnicos reais numa rodada da liga. */
export function leagueRoundPoints(data: LeagueData, round: number): RoundPoints[] {
  const out: RoundPoints[] = [];
  const games = data.fixtures[round - 1]?.length ?? 0;
  for (let i = 0; i < games; i++) {
    const m = matchAt(data, round, i);
    const [h, a] = m.result.score;
    if (m.home.clubId && !m.home.bot) out.push({ club_id: m.home.clubId, ...outcome(h, a), advanced: false });
    if (m.away.clubId && !m.away.bot) out.push({ club_id: m.away.clubId, ...outcome(a, h), advanced: false });
  }
  return out;
}

/** Resultados dos técnicos reais numa fase de copa. */
export function cupRoundPoints(data: CupData, round: number): RoundPoints[] {
  if (round < 1 || round > roundsOf(data.cup.size)) return [];
  const out: RoundPoints[] = [];
  const games = slotsIn(data, round).length / 2;
  for (let i = 0; i < games; i++) {
    const m = cupMatch(data, round, i);
    const [h, a] = m.result.score;
    if (m.home.clubId && !m.home.bot) out.push({ club_id: m.home.clubId, ...outcome(h, a), advanced: m.winner === 0 });
    if (m.away.clubId && !m.away.bot) out.push({ club_id: m.away.clubId, ...outcome(a, h), advanced: m.winner === 1 });
  }
  return out;
}
