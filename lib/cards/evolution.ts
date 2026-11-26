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
import { hash32, rng, type BaseCard } from "./generate";

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

/* ------------------------------------------------------------------ */
/* Potencial: cada carta tem o seu teto                                */
/* ------------------------------------------------------------------ */

/**
 * O teto da raridade (Base 70 / nível 10, Destaque 79 / 20, Épica 89 / 35,
 * Especial 99 / 50) é o MÁXIMO possível — não o destino de toda carta. Cada
 * carta nasce com o seu potencial: até que nível ela chega e quanto de overall
 * ganha no caminho. Jovens costumam ter mais espaço para crescer; veteranos,
 * menos. Só as melhores promessas encostam no teto da raridade.
 *
 * Calculado da seed da carta (sorteio próprio): igual em todo aparelho e no
 * servidor, sem nada no banco, e sem mudar as cartas já geradas.
 */
export type Potential = {
  /** nível máximo desta carta (≤ teto da raridade) */
  maxLevel: number;
  /** overall no nível máximo (≤ teto da raridade) */
  maxOverall: number;
  /** 0–1: o quanto do espaço até o teto da raridade a carta aproveita */
  grade: number;
};

/** Faixa de potencial pela idade (média do quanto aproveita do espaço até o teto). */
function ageMean(age: number) {
  if (age <= 20) return 0.66;
  if (age <= 23) return 0.56;
  if (age <= 27) return 0.46;
  if (age <= 30) return 0.36;
  return 0.26;
}

/** Ganho mínimo de overall até o nível máximo (até a carta mais limitada evolui um pouco). */
const MIN_GROWTH = 2;

/**
 * Potencial da carta. `card` precisa estar no nível 1 (como sai do gerador):
 * o overall dela é o ponto de partida.
 */
export function cardPotential(card: BaseCard): Potential {
  const tier = CARD_TIERS[card.tier ?? "base"];
  const r = rng(hash32(`potencial:${card.seed}:${card.key}`));
  // nota de potencial: idade + sorteio (soma de 3 → concentra no meio, extremos raros)
  const noise = (r() + r() + r() - 1.5) * 0.36;
  const grade = Math.min(1, Math.max(0.12, ageMean(card.age) + noise));
  const room = Math.max(0, tier.maxOverall - card.overall);
  const growth = Math.min(room, Math.max(MIN_GROWTH, Math.round(room * grade)));
  // quem tem mais potencial também vai mais longe nos níveis (com um pouco de variação)
  const lvlGrade = Math.min(1, Math.max(0, grade + (r() - 0.5) * 0.2));
  const minLevel = Math.max(2, Math.ceil(tier.maxLevel * 0.5));
  const maxLevel = Math.min(tier.maxLevel, Math.round(minLevel + (tier.maxLevel - minLevel) * lvlGrade));
  return { maxLevel, maxOverall: Math.min(tier.maxOverall, card.overall + growth), grade };
}

/** Rótulo do potencial para as telas. */
export function potentialLabel(grade: number) {
  return grade >= 0.66 ? "alto" : grade >= 0.4 ? "médio" : "baixo";
}

/** Overall da carta num nível: o ganho se espalha do nível 1 até o nível máximo dela. */
export function overallAtLevel(start: number, pot: Potential, level: number) {
  if (pot.maxLevel <= 1) return start;
  const n = Math.min(level, pot.maxLevel);
  return start + Math.round(((pot.maxOverall - start) * (n - 1)) / (pot.maxLevel - 1));
}

/** Potencial de uma carta já evoluída (ou recém-gerada). */
export function potentialOf(card: BaseCard): Potential {
  if (card.maxLevel !== undefined && card.potential !== undefined) return { maxLevel: card.maxLevel, maxOverall: card.potential, grade: card.grade ?? 0.5 };
  return cardPotential(card);
}

/** Carta com o nível aplicado: overall e atributos sobem até o potencial dela. */
export function evolveCard(card: BaseCard, xp: number): BaseCard {
  const pot = cardPotential(card);
  const { level } = levelFromXp(xp, pot.maxLevel);
  const overall = overallAtLevel(card.overall, pot, level);
  const bonus = overall - card.overall;
  return {
    ...card,
    level,
    overall,
    maxLevel: pot.maxLevel,
    potential: pot.maxOverall,
    grade: pot.grade,
    stats: bonus ? card.stats.map((s) => ({ ...s, value: Math.min(99, s.value + bonus) })) : card.stats,
  };
}

export function evolveSquad(cards: BaseCard[], xp: readonly number[] | null | undefined): BaseCard[] {
  return cards.map((c, i) => evolveCard(c, xp?.[i] ?? 0));
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
