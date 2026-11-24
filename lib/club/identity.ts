/**
 * Identidade visual do clube (escudo e camisa).
 *
 * No banco, cada um é só um código curto de números separados por ponto:
 *   escudo  "formato.padrão.símbolo.cor1.cor2.cor3"  ex.: "0.2.1.5.0.10"
 *   camisa  "modelo.cor1.cor2.cor3"                 ex.: "1.5.0.10"
 * O navegador transforma esse código em desenho (components/club/*).
 * Mudar a arte de um formato no futuro muda todos os clubes de uma vez,
 * sem tocar no banco.
 */

export const PALETTE = [
  { name: "Branco", hex: "#ffffff" },
  { name: "Preto", hex: "#23203a" },
  { name: "Vermelho", hex: "#e8322e" },
  { name: "Grená", hex: "#8c1c3a" },
  { name: "Laranja", hex: "#ff8a1f" },
  { name: "Amarelo", hex: "#ffd23f" },
  { name: "Dourado", hex: "#d9a21b" },
  { name: "Verde", hex: "#2fb34f" },
  { name: "Verde-escuro", hex: "#136f3a" },
  { name: "Celeste", hex: "#3ec5ff" },
  { name: "Azul", hex: "#2563eb" },
  { name: "Marinho", hex: "#1e2a6b" },
  { name: "Roxo", hex: "#8b5cf6" },
  { name: "Rosa", hex: "#ff4f8b" },
  { name: "Marrom", hex: "#8a5a2b" },
  { name: "Cinza", hex: "#9aa3b5" },
] as const;

export const CREST_SHAPES = ["Clássico", "Francês", "Ogiva", "Redondo", "Oval", "Losango", "Hexágono", "Flâmula", "Quadrado"] as const;
export const CREST_PATTERNS = ["Liso", "Listras", "Faixa", "Diagonal", "Metade", "Quartos", "Chevron", "Topo"] as const;
export const CREST_SYMBOLS = ["Sigla", "Estrela", "Bola", "Coroa", "Raio", "Chama", "Torre", "Sol", "Cruz", "Coração", "Lua", "Nenhum"] as const;
export const KIT_MODELS = ["Lisa", "Listras", "Diagonal", "Metade", "Faixa", "Quartos", "Aros"] as const;

export type Crest = { shape: number; pattern: number; symbol: number; c1: number; c2: number; c3: number };
export type Kit = { model: number; c1: number; c2: number; c3: number };

const clamp = (n: number, max: number) => (Number.isInteger(n) && n >= 0 && n < max ? n : 0);

export function encodeCrest(c: Crest): string {
  return [c.shape, c.pattern, c.symbol, c.c1, c.c2, c.c3].join(".");
}

export function decodeCrest(code: string | null | undefined): Crest {
  const [shape, pattern, symbol, c1, c2, c3] = (code ?? "").split(".").map(Number);
  return {
    shape: clamp(shape, CREST_SHAPES.length),
    pattern: clamp(pattern, CREST_PATTERNS.length),
    symbol: clamp(symbol, CREST_SYMBOLS.length),
    c1: clamp(c1, PALETTE.length),
    c2: clamp(c2, PALETTE.length),
    c3: clamp(c3, PALETTE.length),
  };
}

export function encodeKit(k: Kit): string {
  return [k.model, k.c1, k.c2, k.c3].join(".");
}

export function decodeKit(code: string | null | undefined): Kit {
  const [model, c1, c2, c3] = (code ?? "").split(".").map(Number);
  return {
    model: clamp(model, KIT_MODELS.length),
    c1: clamp(c1, PALETTE.length),
    c2: clamp(c2, PALETTE.length),
    c3: clamp(c3, PALETTE.length),
  };
}

/** Sorteia cores bem diferentes entre si para não ficar ilegível. */
function distinctColors(rand: () => number): [number, number, number] {
  const pick = () => Math.floor(rand() * PALETTE.length);
  const c1 = pick();
  let c2 = pick();
  while (c2 === c1) c2 = pick();
  let c3 = pick();
  while (c3 === c1) c3 = pick();
  return [c1, c2, c3];
}

export function randomCrest(rand: () => number = Math.random): Crest {
  const [c1, c2, c3] = distinctColors(rand);
  return {
    shape: Math.floor(rand() * CREST_SHAPES.length),
    pattern: Math.floor(rand() * CREST_PATTERNS.length),
    symbol: Math.floor(rand() * (CREST_SYMBOLS.length - 1)),
    c1,
    c2,
    c3,
  };
}

/** Camisa combinando com o escudo. */
export function kitFromCrest(c: Crest): Kit {
  return { model: [0, 1, 2, 3, 4, 5, 6, 1][c.pattern] ?? 0, c1: c.c1, c2: c.c2, c3: c.c3 };
}

/* ------------------------------------------------------------------ */
/* Nome e sigla — mesmas regras do banco (supabase/migrations)        */
/* ------------------------------------------------------------------ */

export const NAME_MIN = 3;
export const NAME_MAX = 22;
const NAME_CHARS = /^[A-Za-z0-9À-ÿ '.-]+$/;

export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trimStart();
}

/** Retorna a mensagem de erro, ou null se o nome é válido. */
export function validateName(name: string): string | null {
  const n = name.trim();
  if (n.length < NAME_MIN) return `Use pelo menos ${NAME_MIN} letras.`;
  if (n.length > NAME_MAX) return `Use no máximo ${NAME_MAX} caracteres.`;
  if (!NAME_CHARS.test(n)) return "Use só letras, números, espaço, ponto, hífen ou apóstrofo.";
  return null;
}

export function validateTag(tag: string): string | null {
  return /^[A-Z0-9]{3}$/.test(tag) ? null : "A sigla precisa ter 3 letras ou números.";
}

const SKIP = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "FC", "EC", "SC", "AC", "CLUBE", "THE"]);

/** "Tubarões da Vila" → "TUV"; "Flamingo" → "FLA". */
export function suggestTag(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ");
  const words = clean.split(/\s+/).filter(Boolean);
  const main = words.filter((w) => !SKIP.has(w));
  const base = main.length ? main : words;
  if (base.length >= 3) return base.slice(0, 3).map((w) => w[0]).join("");
  if (base.length === 2) return (base[0].slice(0, 2) + base[1][0]).slice(0, 3);
  return (base[0] ?? "").slice(0, 3);
}

export function sanitizeTag(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
}
