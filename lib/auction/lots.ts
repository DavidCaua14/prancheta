/**
 * Leilão do Prancheta — regras compartilhadas (aparelho, Edge Function e,
 * espelhadas em SQL, o banco: auction_tier(), auction_min(), place_bid()).
 *
 * A cada 2 horas abre uma RODADA com 8 lotes. O lote é só um número
 * (rodada, índice): raridade, posição e a carta inteira saem dele, sempre
 * iguais, em qualquer aparelho. O banco guarda apenas o maior lance de cada
 * lote que recebeu lance (auction_lots).
 */
import { generateCard, hash32, type BaseCard, type Position } from "@/lib/cards/generate";
import type { CardTier } from "@/lib/game-config";

/** Duração da rodada (o mesmo valor está em place_bid). */
export const ROUND_SECONDS = 7200;
export const LOTS_PER_ROUND = 8;
/** Lance no último minuto empurra o fim do lote para daqui a 1 minuto. */
export const EXTEND_SECONDS = 60;
/** Cartas que um clube pode ter além das 14 da peneira (ganhas + liderando). */
export const MAX_EXTRA_CARDS = 10;
export const START_COINS = 1000;

export type LotTier = Exclude<CardTier, "base">;

export const MIN_BID: Record<LotTier, number> = { destaque: 300, epica: 900, especial: 2500 };

/** Raridade do lote (espelho de auction_tier no SQL). */
export function lotTier(round: number, idx: number): LotTier {
  if (idx <= 4) return "destaque";
  if (idx <= 6) return "epica";
  return round % 4 === 0 ? "especial" : "destaque";
}

/** Menor lance aceito: o mínimo da raridade, ou +5% (pelo menos +10) sobre o maior lance. */
export function nextMinBid(tier: LotTier, best: number | null) {
  if (best === null) return MIN_BID[tier];
  return Math.max(best + 10, Math.ceil(best * 1.05));
}

export function roundAt(ms: number) {
  return Math.floor(ms / 1000 / ROUND_SECONDS);
}
export function roundStart(round: number) {
  return round * ROUND_SECONDS * 1000;
}
export function roundEnd(round: number) {
  return roundStart(round + 1);
}

const POSITIONS: Position[] = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "MC", "MEI", "PD", "PE", "ATA", "ATA"];

/** A carta do lote (determinística). */
export function lotCard(round: number, idx: number): BaseCard {
  const seed = hash32(`leilao:v1:${round}:${idx}`);
  const position = POSITIONS[seed % POSITIONS.length];
  return generateCard(hash32(`leilao:carta:${seed}`), position, `L${round}-${idx}`, lotTier(round, idx));
}

/** Lote arrematado por um clube. */
export type WonLot = { round: number; idx: number; ends_at: string };

/**
 * Cartas extras do clube válidas no instante `at`, em ordem estável
 * (data de arremate, depois rodada e índice). A posição na lista é o índice
 * da carta no elenco (14, 15, ...) — por isso a ordem nunca pode mudar.
 */
export function wonAt(won: readonly WonLot[] | null | undefined, at: number): WonLot[] {
  if (!won?.length) return [];
  return won
    .filter((w) => new Date(w.ends_at).getTime() <= at)
    .sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime() || a.round - b.round || a.idx - b.idx)
    .slice(0, MAX_EXTRA_CARDS);
}
