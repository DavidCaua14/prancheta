/**
 * Hora do jogo (ms) = relógio do aparelho + diferença para o servidor.
 * Sem dependências: roda no aparelho e nas Edge Functions (lá a diferença é 0).
 * Quem acerta a diferença é syncClock (lib/clock.ts), no navegador.
 */
let offset = 0;

export function serverNow() {
  return Date.now() + offset;
}

export function setClockOffset(ms: number) {
  offset = ms;
}

export function clockOffset() {
  return offset;
}
