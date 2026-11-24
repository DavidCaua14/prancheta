/**
 * Gerador de cartas determinístico.
 *
 * Uma carta Base nasce de uma seed: (id do clube, vaga da peneira, nº da opção).
 * A mesma seed gera SEMPRE a mesma carta, em qualquer aparelho. Por isso o
 * banco não guarda cartas — só a escolha feita em cada vaga (ver squad.ts).
 *
 * ⚠️ Não altere a lógica da versão 1 depois de publicada: isso mudaria as
 * cartas de todos os clubes. Para mudar, crie GENERATOR_V2 e um novo prefixo.
 */

import { CARD_TIERS } from "@/lib/game-config";
import { FIRST_NAMES, NICKNAMES, SURNAMES } from "./names";

export const GENERATOR_VERSION = 1;

export type Position = "GOL" | "ZAG" | "LD" | "LE" | "VOL" | "MC" | "MEI" | "PD" | "PE" | "ATA";

export const POSITION_NAMES: Record<Position, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LD: "Lateral-direito",
  LE: "Lateral-esquerdo",
  VOL: "Volante",
  MC: "Meia-central",
  MEI: "Meia-armador",
  PD: "Ponta-direita",
  PE: "Ponta-esquerda",
  ATA: "Atacante",
};

export type HairStyle = "short" | "afro" | "mohawk" | "bald" | "long" | "cap";

export type BaseCard = {
  /** Identificador estável: "<vaga>-<opção>". */
  key: string;
  seed: number;
  name: string;
  position: Position;
  overall: number;
  level: number;
  age: number;
  foot: "D" | "E";
  stats: { label: string; value: number }[];
  look: { skin: string; hair: string; hairStyle: HairStyle; beard: boolean; headband?: string };
};

/* ------------------------------------------------------------------ */
/* Aleatoriedade determinística                                        */
/* ------------------------------------------------------------------ */

/** FNV-1a 32 bits. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];

/* ------------------------------------------------------------------ */
/* Perfis de posição                                                   */
/* ------------------------------------------------------------------ */

const FIELD_LABELS = ["VEL", "FIN", "PAS", "DRI", "DEF", "FÍS"];
const GK_LABELS = ["REF", "POS", "SAÍ", "MÃO", "PÉS", "FÍS"];

/** offsets em relação ao nível do jogador, e pesos para calcular o overall. */
const PROFILES: Record<Position, { off: number[]; w: number[] }> = {
  GOL: { off: [6, 4, 0, 3, -8, 0], w: [0.3, 0.25, 0.15, 0.2, 0.05, 0.05] },
  ZAG: { off: [-6, -18, -4, -12, 8, 6], w: [0.1, 0, 0.1, 0, 0.45, 0.35] },
  LD: { off: [6, -12, 0, -2, 2, 0], w: [0.3, 0, 0.2, 0.15, 0.25, 0.1] },
  LE: { off: [6, -12, 0, -2, 2, 0], w: [0.3, 0, 0.2, 0.15, 0.25, 0.1] },
  VOL: { off: [-4, -10, 2, -4, 6, 4], w: [0.1, 0, 0.3, 0.05, 0.35, 0.2] },
  MC: { off: [0, -4, 6, 2, -4, 0], w: [0.1, 0.1, 0.4, 0.2, 0.1, 0.1] },
  MEI: { off: [2, 2, 6, 6, -14, -6], w: [0.1, 0.2, 0.35, 0.3, 0, 0.05] },
  PD: { off: [8, 2, 0, 6, -16, -6], w: [0.35, 0.2, 0.1, 0.3, 0, 0.05] },
  PE: { off: [8, 2, 0, 6, -16, -6], w: [0.35, 0.2, 0.1, 0.3, 0, 0.05] },
  ATA: { off: [2, 8, -4, 2, -18, 4], w: [0.15, 0.5, 0.05, 0.15, 0, 0.15] },
};

const SKINS = ["#f5d0b0", "#e9b98f", "#c68b5e", "#a66a3f", "#8d5a3b", "#5b3a26"];
const HAIRS = ["#1b1038", "#2a1a10", "#5a3418", "#a86a2a", "#e0a526"];
const STYLES: HairStyle[] = ["short", "short", "short", "afro", "mohawk", "bald", "long", "cap"];
const BANDS = ["#ffd23f", "#ff4f8b", "#3ec5ff", "#ffffff"];

function weighted(stats: number[], w: number[]) {
  let s = 0;
  let t = 0;
  stats.forEach((v, i) => {
    s += v * w[i];
    t += w[i];
  });
  return s / t;
}

/** Gera a carta Base de uma seed para a posição pedida. */
export function generateBaseCard(seed: number, position: Position, key: string): BaseCard {
  const r = rng(seed);
  const [lo, hi] = CARD_TIERS.base.startOverall;

  // nível alvo concentrado no meio da faixa (média de dois sorteios)
  const target = Math.round(lo + ((r() + r()) / 2) * (hi - lo));
  const prof = PROFILES[position];
  let raw = prof.off.map((o) => target + o + Math.round((r() - 0.5) * 10));
  // ajusta para o overall bater com o alvo
  const shift = Math.round(target - weighted(raw, prof.w));
  raw = raw.map((v) => Math.min(85, Math.max(20, v + shift)));
  const overall = Math.min(hi, Math.max(lo, Math.round(weighted(raw, prof.w))));

  const labels = position === "GOL" ? GK_LABELS : FIELD_LABELS;
  const name =
    r() < 0.45 ? pick(r, NICKNAMES) : `${pick(r, FIRST_NAMES)} ${pick(r, SURNAMES)}`;
  const hairStyle = pick(r, STYLES);

  return {
    key,
    seed,
    name,
    position,
    overall,
    level: 1,
    age: 17 + Math.floor(r() * 17),
    foot: position === "LE" || position === "PE" ? (r() < 0.8 ? "E" : "D") : r() < 0.75 ? "D" : "E",
    stats: labels.map((label, i) => ({ label, value: raw[i] })),
    look: {
      skin: pick(r, SKINS),
      hair: pick(r, HAIRS),
      hairStyle,
      beard: r() < 0.3,
      headband: hairStyle !== "cap" && r() < 0.12 ? pick(r, BANDS) : undefined,
    },
  };
}
