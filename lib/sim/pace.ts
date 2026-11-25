/**
 * Ritmo das partidas na tela (quanto tempo real dura um minuto de jogo).
 *
 * • Liga e copas: 6 s por minuto → 90' + acréscimos ≈ 9,5 a 10 minutos.
 * • Treino (amistoso): no 1x, 4,5 s por minuto (~7 min) — dá para acompanhar
 *   cada jogada no quadro; 2x e 4x para quem quer ver mais rápido.
 */
export const ONLINE_MS_PER_MINUTE = 6000;

export const TRAINING_SPEEDS = [
  { label: "1x", ms: 4500 },
  { label: "2x", ms: 2200 },
  { label: "4x", ms: 1000 },
];
