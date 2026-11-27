/**
 * Prancheta Temporadas: outro jogo (modo carreira, grátis), em outro site.
 * Do online dá para ir para lá e vice-versa; `ref`/`slot` dizem de onde veio.
 */
export const TEMPORADAS_URL = process.env.NEXT_PUBLIC_TEMPORADAS_URL ?? "https://prancheta-temporadas.vercel.app";

export const temporadasLink = (slot: string) => `${TEMPORADAS_URL}/?ref=online&slot=${slot}`;
