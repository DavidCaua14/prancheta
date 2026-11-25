/**
 * Evolução das cartas: XP → nível → overall.
 *
 * O banco guarda só o XP acumulado de cada carta (clubs.xp, 14 números) e ele
 * só muda no fechamento da temporada (Edge Function close-league). Durante a
 * temporada o aparelho calcula o XP "a receber" com o mesmo código.
 *
 * Por que só no fim da temporada? Os jogos da liga são recalculados por todo
 * mundo: a força das cartas precisa ser a mesma do 1º ao último jogo.
 */
import { CARD_TIERS } from "@/lib/game-config";
import type { MatchResult } from "@/lib/sim/engine";
import type { BaseCard } from "./generate";

export const XP_RULES = {
  /** jogou desde o início / entrou no decorrer */
  starter: 6,
  sub: 4,
  /** ficou no banco: treino */
  bench: 2,
  goal: 4,
  assist: 2,
  /** nota ≥ 7 / ≥ 8 */
  good: 3,
  great: 6,
  win: 3,
  draw: 1,
  /** bônus de fim de temporada, para cada carta do elenco */
  promotion: 40,
  title: 60,
} as const;

/** Teto que o servidor aceita por carta numa temporada (trava de segurança, espelhada no SQL). */
export const MAX_SEASON_XP = 3000;

/** XP para ir do nível n para o n+1. */
export function levelCost(n: number) {
  return 50 + 25 * (n - 1);
}

export type LevelInfo = { level: number; into: number; need: number; max: boolean };

export function levelFromXp(xp: number, maxLevel: number): LevelInfo {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (level < maxLevel && left >= levelCost(level)) {
    left -= levelCost(level);
    level++;
  }
  const max = level >= maxLevel;
  return { level, into: max ? 0 : left, need: max ? 0 : levelCost(level), max };
}

/** XP total para chegar ao nível máximo de um tipo de carta. */
export function xpToMax(maxLevel: number) {
  let t = 0;
  for (let n = 1; n < maxLevel; n++) t += levelCost(n);
  return t;
}

/** Carta com o nível aplicado: +1 de overall e de cada atributo por nível, até o teto do tipo. */
export function evolveCard(card: BaseCard, xp: number): BaseCard {
  const tier = CARD_TIERS.base;
  const { level } = levelFromXp(xp, tier.maxLevel);
  const target = Math.min(tier.maxOverall, Math.max(card.overall, card.overall + level - 1));
  const bonus = target - card.overall;
  if (level === card.level && bonus === 0) return card;
  return { ...card, level, overall: target, stats: card.stats.map((s) => ({ ...s, value: Math.min(99, s.value + bonus) })) };
}

export function evolveSquad(cards: BaseCard[], xp: readonly number[] | null | undefined): BaseCard[] {
  if (!xp) return cards;
  return cards.map((c, i) => evolveCard(c, xp[i] ?? 0));
}

/** XP de cada carta (índice do elenco) num jogo. `side`: 0 = mandante, 1 = visitante. */
export function matchXp(result: MatchResult, side: 0 | 1, startersXi: readonly number[], squadSize: number): number[] {
  const R = XP_RULES;
  const rat = result.ratings[side];
  const [mine, theirs] = side === 0 ? result.score : [result.score[1], result.score[0]];
  const res = mine > theirs ? R.win : mine === theirs ? R.draw : 0;
  const xp = Array.from({ length: squadSize }, () => 0);
  for (let i = 0; i < squadSize; i++) {
    const r = rat[i];
    if (r === undefined) {
      xp[i] = R.bench;
      continue;
    }
    xp[i] = (startersXi.includes(i) ? R.starter : R.sub) + (r >= 8 ? R.great : r >= 7 ? R.good : 0) + res;
  }
  for (const e of result.events) {
    if (e.team !== side) continue;
    if ((e.type === "goal" || e.type === "penalty_goal") && e.player !== undefined && e.player < squadSize) xp[e.player] += R.goal;
    if (e.type === "goal" && e.other !== undefined && e.other < squadSize) xp[e.other] += R.assist;
  }
  return xp;
}

/** Bônus de fim de temporada para cada carta. */
export function seasonBonus(pos: number, move: number) {
  return (move > 0 ? XP_RULES.promotion : 0) + (pos === 1 ? XP_RULES.title : 0);
}

export function addXp(a: readonly number[] | null | undefined, b: readonly number[], size = 14): number[] {
  return Array.from({ length: size }, (_, i) => Math.min(32000, (a?.[i] ?? 0) + (b[i] ?? 0)));
}
