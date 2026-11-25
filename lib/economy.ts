/**
 * Economia do Prancheta — todos os números num lugar só.
 * Os valores que o banco usa estão espelhados em SQL (season_prize, cup_prize,
 * default de clubs.coins). Mudou aqui, mude lá (migração nova).
 *
 * Meta (por semana, técnico ativo sem pagar nada):
 *   liga (~3 temporadas) ~2.400 · Copa da Várzea ~1.000 · eventos ~3.000
 *   = ~6.500 moedas → uma Épica disputada ou uma Especial a cada 1–2 semanas.
 * Campeões ganham bem mais: o título é o atalho para reforçar o time.
 */

/** Moedas com que todo clube começa (dá para uma Destaque logo no 1º dia). */
export const START_COINS = 1500;

/** Prêmio do 1º colocado por divisão (Várzea, D, C, B, A, Lendas). */
export const SEASON_PRIZE_BASE = [1200, 1800, 2600, 3600, 5000, 7000] as const;

/**
 * Prêmio de fim de temporada (espelho de season_prize no SQL):
 * cai em linha reta do 1º (100%) ao último (25%) e o campeão leva +50%.
 */
export function seasonPrize(division: number, pos: number, size = 10) {
  const base = SEASON_PRIZE_BASE[Math.min(Math.max(division, 0), 5)];
  return Math.round((base * (size - pos + 3)) / (size + 2)) + (pos === 1 ? Math.round(base / 2) : 0);
}

/** Pacotes da loja (pagamento ainda não liberado: só vitrine). */
export type CoinPack = {
  id: string;
  name: string;
  coins: number;
  /** moedas extras já incluídas em `coins` */
  bonus: number;
  /** preço em reais */
  price: number;
  art: string;
  tag?: string;
  /** só uma compra por clube */
  once?: boolean;
};

export const COIN_PACKS: CoinPack[] = [
  { id: "estreia", name: "Oferta de estreia", coins: 8000, bonus: 5000, price: 4.9, art: "pack-estreia", tag: "Só 1 vez", once: true },
  { id: "punhado", name: "Punhado de moedas", coins: 3000, bonus: 0, price: 4.9, art: "pack-punhado" },
  { id: "saco", name: "Saco de moedas", coins: 7000, bonus: 1000, price: 9.9, art: "pack-saco" },
  { id: "bau", name: "Baú do roupeiro", coins: 16000, bonus: 4000, price: 19.9, art: "pack-bau", tag: "Mais vendido" },
  { id: "cofre", name: "Cofre do clube", coins: 45000, bonus: 15000, price: 49.9, art: "pack-cofre" },
  { id: "tesouro", name: "Tesouro do presidente", coins: 100000, bonus: 40000, price: 99.9, art: "pack-tesouro", tag: "Melhor valor" },
];

export function fmtPrice(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
