/**
 * Leilão do Prancheta — regras compartilhadas (aparelho, Edge Function e,
 * espelhadas em SQL, o banco: auction_tier(), auction_min(), place_bid()).
 *
 * A cada 2 horas abre uma RODADA com 12 vagas. O lote é só um número
 * (rodada, índice): raridade, posição e a carta inteira saem dele, sempre
 * iguais, em qualquer aparelho. O banco guarda apenas o maior lance de cada
 * lote que recebeu lance (auction_lots).
 *
 * Reposição: quando um lote é arrematado antes do fim da rodada, a vaga
 * recebe a carta seguinte na hora (mesma raridade). Índice = vaga + 12 ×
 * geração (vaga 3: lotes 3, 15, 27...). Espelho em place_bid.
 */
import { generateCard, hash32, type BaseCard, type Position } from "@/lib/cards/generate";
import type { CardTier } from "@/lib/game-config";

/** Duração da rodada (o mesmo valor está em place_bid). */
export const ROUND_SECONDS = 7200;
/** 12 vagas por rodada: 8 raras (0–7) + 4 de cartas Base boas (8–11). */
export const LOTS_PER_ROUND = 12;
/** Gerações por vaga numa rodada (cartas que entram no lugar das arrematadas); espelho de place_bid. */
export const MAX_GENERATIONS = 20;

/** Vaga (0–11) de um índice de lote. */
export function slotOf(idx: number) {
  return idx % LOTS_PER_ROUND;
}
/** Cada lance novo marca o fim do lote para daqui a 10 minutos (espelho de place_bid). */
export const BID_WINDOW_SECONDS = 600;
/** Moedas iniciais: ver lib/economy.ts (START_COINS). */
export { START_COINS } from "@/lib/economy";

export type LotTier = CardTier;

/**
 * Lance mínimo por raridade (espelho de auction_min). Base = o que os prêmios
 * compram; Destaque/Épica/Especial = paciência nos eventos ou pacote da loja.
 */
export const MIN_BID: Record<LotTier, number> = { base: 100, destaque: 1500, epica: 5000, especial: 15000 };

/** Raridade do lote (espelho de auction_tier no SQL). */
export function lotTier(round: number, idx: number): LotTier {
  const slot = slotOf(idx);
  if (slot >= 8) return "base";
  if (slot <= 4) return "destaque";
  if (slot <= 6) return "epica";
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

const lotCache = new Map<string, BaseCard>();

/** A carta do lote (determinística; guardada depois da 1ª vez — a tela pede a cada segundo). */
export function lotCard(round: number, idx: number): BaseCard {
  const k = `${round}:${idx}`;
  const hit = lotCache.get(k);
  if (hit) return hit;
  if (lotCache.size > 2000) lotCache.clear();
  const card = makeLotCard(round, idx);
  lotCache.set(k, card);
  return card;
}

function makeLotCard(round: number, idx: number): BaseCard {
  const seed = hash32(`leilao:v1:${round}:${idx}`);
  const position = POSITIONS[seed % POSITIONS.length];
  const tier = lotTier(round, idx);
  if (tier !== "base") return generateCard(hash32(`leilao:carta:${seed}`), position, `L${round}-${idx}`, tier);
  // carta Base "boa": a melhor de 3 sorteios para a posição
  let best = generateCard(hash32(`leilao:carta:${seed}:0`), position, `L${round}-${idx}`, "base");
  for (let k = 1; k < 3; k++) {
    const c = generateCard(hash32(`leilao:carta:${seed}:${k}`), position, `L${round}-${idx}`, "base");
    if (c.overall > best.overall) best = c;
  }
  return best;
}

/**
 * Lote em exibição numa vaga: a geração mais nova. Um lote arrematado antes
 * do fim da rodada abre a vez do seguinte (que começa sem lances).
 */
export function currentLotIdx(round: number, slot: number, endsAt: (idx: number) => number | null, now: number): number {
  const end = roundEnd(round);
  let idx = slot;
  for (let g = 0; g < MAX_GENERATIONS - 1; g++) {
    const e = endsAt(idx);
    if (e === null || e > now || e >= end) return idx;
    idx += LOTS_PER_ROUND;
  }
  return idx;
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
    .sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime() || a.round - b.round || a.idx - b.idx);
}
