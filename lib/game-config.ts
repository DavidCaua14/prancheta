/**
 * Regras de jogo compartilhadas entre cliente e servidor.
 * Mantidas em código (e não no banco) para economizar leituras:
 * o banco guarda só o que muda por usuário.
 */

export type CardTier = "base" | "destaque" | "epica" | "especial";

export type TierInfo = {
  id: CardTier;
  label: string;
  /** Overall máximo que a carta pode alcançar evoluindo. */
  maxOverall: number;
  /** Faixa de overall com que a carta nasce. */
  startOverall: [number, number];
  /** Nível máximo de evolução. */
  maxLevel: number;
  /** Como o jogador consegue esse tipo de carta. */
  howToGet: string;
  /** Limite de cartas desse tipo por elenco (null = sem limite). */
  squadLimit: number | null;
};

export const CARD_TIERS: Record<CardTier, TierInfo> = {
  base: {
    id: "base",
    label: "Base",
    maxOverall: 70,
    startOverall: [45, 60],
    maxLevel: 10,
    howToGet: "Grátis: base do clube, recompensas e olheiro",
    squadLimit: null,
  },
  destaque: {
    id: "destaque",
    label: "Destaque",
    maxOverall: 79,
    startOverall: [58, 68],
    maxLevel: 20,
    howToGet: "Prêmios de liga, copas e leilão",
    squadLimit: 8,
  },
  epica: {
    id: "epica",
    label: "Épica",
    maxOverall: 89,
    startOverall: [66, 76],
    maxLevel: 35,
    howToGet: "Leilão, títulos e eventos",
    squadLimit: 4,
  },
  especial: {
    id: "especial",
    label: "Especial",
    maxOverall: 99,
    startOverall: [74, 84],
    maxLevel: 50,
    howToGet: "Leilão e eventos raros",
    squadLimit: 2,
  },
};

export const TIER_ORDER: CardTier[] = ["base", "destaque", "epica", "especial"];

export type Division = {
  id: string;
  name: string;
  short: string;
  description: string;
};

/** Pirâmide de divisões: todo novo clube começa na Várzea. */
export const DIVISIONS: Division[] = [
  { id: "varzea", name: "Várzea", short: "VAR", description: "Todo clube novo começa aqui. Terrão, rede furada e muita vontade." },
  { id: "serie-d", name: "Série D", short: "D", description: "Primeiro passo no futebol de verdade. Estádio pequeno, torcida fiel." },
  { id: "serie-c", name: "Série C", short: "C", description: "O leilão começa a pesar. Cartas Destaque fazem diferença." },
  { id: "serie-b", name: "Série B", short: "B", description: "Briga de cachorro grande pelo acesso." },
  { id: "serie-a", name: "Série A", short: "A", description: "A elite nacional. Cada rodada vale ouro." },
  { id: "liga-lendas", name: "Liga das Lendas", short: "★", description: "Só os melhores técnicos do servidor." },
];

export type Cup = { id: string; name: string; unlock: string; color: string };

export const CUPS: Cup[] = [
  { id: "copa-varzea", name: "Copa da Várzea", unlock: "Liberada desde o 1º dia", color: "var(--orange)" },
  { id: "copa-nacional", name: "Copa Nacional", unlock: "A partir da Série C", color: "var(--sky)" },
  { id: "supercopa", name: "Supercopa", unlock: "Campeões de divisão", color: "var(--hot)" },
  { id: "copa-lendas", name: "Copa das Lendas", unlock: "Liga das Lendas", color: "var(--sun)" },
];
