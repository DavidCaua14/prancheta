/**
 * Prancheta Temporadas — PROTÓTIPO. Clubes reais com escudo (arquivos em
 * public/tp/logos/br, gerados por scripts/tp-build-logos.mjs a partir de
 * data-src/logos/br). Na versão completa isto vem do pacote de dados
 * (docs/PRANCHETA_TEMPORADAS.md, seção 8).
 */

export type TpClub = {
  slug: string;
  name: string;
  tag: string;
  uf: string;
  /** 0 = Série D, 1 = C, 2 = B, 3 = A (só para o protótipo: força dos elencos gerados) */
  level: 0 | 1 | 2 | 3;
};

/** Clubes para começar a carreira (divisões de acesso). */
export const START_CLUBS: TpClub[] = [
  { slug: "aguia-de-maraba", name: "Águia de Marabá", tag: "AGM", uf: "PA", level: 0 },
  { slug: "tuna-luso", name: "Tuna Luso", tag: "TUN", uf: "PA", level: 0 },
  { slug: "castanhal", name: "Castanhal", tag: "CAS", uf: "PA", level: 0 },
  { slug: "independente-ap", name: "Independente", tag: "IND", uf: "AP", level: 0 },
  { slug: "trem", name: "Trem", tag: "TRE", uf: "AP", level: 0 },
  { slug: "monte-roraima", name: "Monte Roraima", tag: "MRR", uf: "RR", level: 0 },
  { slug: "nacional-am", name: "Nacional", tag: "NAC", uf: "AM", level: 0 },
  { slug: "manauara", name: "Manauara", tag: "MAN", uf: "AM", level: 0 },
  { slug: "imperatriz", name: "Imperatriz", tag: "IMP", uf: "MA", level: 0 },
  { slug: "altos", name: "Altos", tag: "ALT", uf: "PI", level: 0 },
  { slug: "sousa", name: "Sousa", tag: "SOU", uf: "PB", level: 0 },
  { slug: "itabaiana", name: "Itabaiana", tag: "ITA", uf: "SE", level: 0 },
  { slug: "asa", name: "ASA", tag: "ASA", uf: "AL", level: 0 },
  { slug: "gama", name: "Gama", tag: "GAM", uf: "DF", level: 0 },
  { slug: "anapolis", name: "Anápolis", tag: "ANA", uf: "GO", level: 0 },
  { slug: "maringa", name: "Maringá", tag: "MAR", uf: "PR", level: 0 },
];

/** Clubes maiores: propostas de emprego e artes de divulgação. */
export const BIG_CLUBS: TpClub[] = [
  { slug: "vila-nova", name: "Vila Nova", tag: "VIL", uf: "GO", level: 2 },
  { slug: "crb", name: "CRB", tag: "CRB", uf: "AL", level: 2 },
  { slug: "goias", name: "Goiás", tag: "GOI", uf: "GO", level: 2 },
  { slug: "sport", name: "Sport", tag: "SPT", uf: "PE", level: 2 },
  { slug: "flamengo", name: "Flamengo", tag: "FLA", uf: "RJ", level: 3 },
  { slug: "palmeiras", name: "Palmeiras", tag: "PAL", uf: "SP", level: 3 },
  { slug: "corinthians", name: "Corinthians", tag: "COR", uf: "SP", level: 3 },
  { slug: "sao-paulo", name: "São Paulo", tag: "SAO", uf: "SP", level: 3 },
  { slug: "gremio", name: "Grêmio", tag: "GRE", uf: "RS", level: 3 },
  { slug: "internacional", name: "Internacional", tag: "INT", uf: "RS", level: 3 },
  { slug: "vasco", name: "Vasco", tag: "VAS", uf: "RJ", level: 3 },
  { slug: "botafogo", name: "Botafogo", tag: "BOT", uf: "RJ", level: 3 },
  { slug: "cruzeiro", name: "Cruzeiro", tag: "CRU", uf: "MG", level: 3 },
  { slug: "atletico-mg", name: "Atlético-MG", tag: "CAM", uf: "MG", level: 3 },
  { slug: "fluminense", name: "Fluminense", tag: "FLU", uf: "RJ", level: 3 },
  { slug: "santos", name: "Santos", tag: "SAN", uf: "SP", level: 3 },
  { slug: "bahia", name: "Bahia", tag: "BAH", uf: "BA", level: 3 },
  { slug: "fortaleza", name: "Fortaleza", tag: "FOR", uf: "CE", level: 3 },
];

const ALL = new Map([...START_CLUBS, ...BIG_CLUBS].map((c) => [c.slug, c]));

export function tpClub(slug: string): TpClub {
  return ALL.get(slug) ?? START_CLUBS[0];
}

export function crestSrc(slug: string, size: 48 | 128 = 128) {
  return `/tp/logos/br/${slug}-${size}.webp`;
}

/** Trios "do pequeno ao gigante" para as artes de carreira (giram por dia). */
export const JOURNEYS: [string, string, string][] = [
  ["aguia-de-maraba", "vila-nova", "flamengo"],
  ["itabaiana", "crb", "palmeiras"],
  ["gama", "goias", "corinthians"],
  ["altos", "sport", "sao-paulo"],
  ["maringa", "vila-nova", "gremio"],
  ["tuna-luso", "goias", "botafogo"],
];

/**
 * Onde ficam os escudos em branco de cada arte (centro x/y e largura, em %
 * da imagem), medidos nas imagens geradas. O escudo real é desenhado por cima.
 */
export const CREST_SLOTS: Record<string, { x: number; y: number; w: number }[]> = {
  "promo-tp-hero": [
    { x: 12.3, y: 67.2, w: 3.6 },
    { x: 50, y: 53.6, w: 6 },
    { x: 82.2, y: 36.8, w: 8.6 },
  ],
  "promo-tp-landing": [
    { x: 48.3, y: 24.1, w: 4.8 },
    { x: 59.4, y: 23.9, w: 4.8 },
    { x: 70.2, y: 23.9, w: 4.8 },
  ],
  "promo-tp-cartao": [
    { x: 23, y: 22.8, w: 8 },
    { x: 49.8, y: 15.5, w: 8.4 },
    { x: 76.8, y: 23, w: 8.4 },
  ],
  "promo-tp-proposta": [{ x: 49.8, y: 27, w: 22 }],
  "promo-tp-elenco": [{ x: 50, y: 39.8, w: 9 }],
};
