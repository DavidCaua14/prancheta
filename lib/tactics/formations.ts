/**
 * Formações, encaixe de posição e força por setor.
 * Como no Brasfoot: jogador fora de posição rende menos.
 */

import type { BaseCard, Position } from "@/lib/cards/generate";

export type FormationSlot = { role: Position; spot: [number, number] };
export type Formation = { id: number; name: string; slots: FormationSlot[] };

const GOL: FormationSlot = { role: "GOL", spot: [50, 90] };
const back4: FormationSlot[] = [
  { role: "ZAG", spot: [63, 74] },
  { role: "ZAG", spot: [37, 74] },
  { role: "LD", spot: [86, 66] },
  { role: "LE", spot: [14, 66] },
];
const back3: FormationSlot[] = [
  { role: "ZAG", spot: [50, 76] },
  { role: "ZAG", spot: [74, 72] },
  { role: "ZAG", spot: [26, 72] },
];

/** A ordem das vagas do 4-3-3 é a mesma da peneira (elenco inicial). */
export const FORMATIONS: Formation[] = [
  {
    id: 0,
    name: "4-3-3",
    slots: [
      GOL,
      ...back4,
      { role: "VOL", spot: [50, 56] },
      { role: "MC", spot: [29, 44] },
      { role: "MEI", spot: [71, 44] },
      { role: "PD", spot: [82, 22] },
      { role: "PE", spot: [18, 22] },
      { role: "ATA", spot: [50, 14] },
    ],
  },
  {
    id: 1,
    name: "4-4-2",
    slots: [
      GOL,
      ...back4,
      { role: "VOL", spot: [62, 52] },
      { role: "MC", spot: [38, 52] },
      { role: "PD", spot: [86, 36] },
      { role: "PE", spot: [14, 36] },
      { role: "ATA", spot: [62, 16] },
      { role: "ATA", spot: [38, 16] },
    ],
  },
  {
    id: 2,
    name: "3-5-2",
    slots: [
      GOL,
      ...back3,
      { role: "VOL", spot: [50, 56] },
      { role: "MC", spot: [30, 44] },
      { role: "MEI", spot: [70, 44] },
      { role: "LD", spot: [89, 44] },
      { role: "LE", spot: [11, 44] },
      { role: "ATA", spot: [62, 16] },
      { role: "ATA", spot: [38, 16] },
    ],
  },
  {
    id: 3,
    name: "4-5-1",
    slots: [
      GOL,
      ...back4,
      { role: "VOL", spot: [63, 54] },
      { role: "VOL", spot: [37, 54] },
      { role: "MEI", spot: [50, 38] },
      { role: "PD", spot: [85, 30] },
      { role: "PE", spot: [15, 30] },
      { role: "ATA", spot: [50, 14] },
    ],
  },
  {
    id: 4,
    name: "5-3-2",
    slots: [
      GOL,
      ...back3,
      { role: "LD", spot: [90, 60] },
      { role: "LE", spot: [10, 60] },
      { role: "VOL", spot: [50, 52] },
      { role: "MC", spot: [72, 42] },
      { role: "MC", spot: [28, 42] },
      { role: "ATA", spot: [62, 16] },
      { role: "ATA", spot: [38, 16] },
    ],
  },
  {
    id: 5,
    name: "3-4-3",
    slots: [
      GOL,
      ...back3,
      { role: "LD", spot: [88, 48] },
      { role: "LE", spot: [12, 48] },
      { role: "VOL", spot: [37, 54] },
      { role: "MC", spot: [63, 50] },
      { role: "PD", spot: [82, 22] },
      { role: "PE", spot: [18, 22] },
      { role: "ATA", spot: [50, 14] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Encaixe de posição                                                  */
/* ------------------------------------------------------------------ */

/** Quanto do overall o jogador rende em cada função (1 = posição dele). */
const FIT: Record<Position, Partial<Record<Position, number>>> = {
  GOL: {},
  ZAG: { VOL: 0.85, LD: 0.8, LE: 0.8 },
  LD: { LE: 0.9, PD: 0.82, ZAG: 0.8, VOL: 0.72, PE: 0.75 },
  LE: { LD: 0.9, PE: 0.82, ZAG: 0.8, VOL: 0.72, PD: 0.75 },
  VOL: { MC: 0.9, ZAG: 0.82, MEI: 0.78, LD: 0.72, LE: 0.72 },
  MC: { VOL: 0.9, MEI: 0.9, PD: 0.75, PE: 0.75, ATA: 0.7 },
  MEI: { MC: 0.9, ATA: 0.82, PD: 0.82, PE: 0.82, VOL: 0.75 },
  PD: { PE: 0.9, ATA: 0.85, MEI: 0.8, LD: 0.75, MC: 0.72 },
  PE: { PD: 0.9, ATA: 0.85, MEI: 0.8, LE: 0.75, MC: 0.72 },
  ATA: { PD: 0.85, PE: 0.85, MEI: 0.8, MC: 0.65 },
};

export function fit(player: Position, role: Position): number {
  if (player === role) return 1;
  if (player === "GOL" || role === "GOL") return 0.3; // goleiro na linha / jogador no gol
  return FIT[player][role] ?? 0.6;
}

export function effective(card: BaseCard, role: Position): number {
  return Math.round(card.overall * fit(card.position, role));
}

/** Cor do encaixe: verde (posição), amarelo (adaptado), vermelho (improvisado). */
export function fitLevel(card: BaseCard, role: Position): "ok" | "adapted" | "bad" {
  const f = fit(card.position, role);
  return f >= 1 ? "ok" : f >= 0.8 ? "adapted" : "bad";
}

const SECTOR: Record<Position, "def" | "mei" | "ata"> = {
  GOL: "def",
  ZAG: "def",
  LD: "def",
  LE: "def",
  VOL: "mei",
  MC: "mei",
  MEI: "mei",
  PD: "ata",
  PE: "ata",
  ATA: "ata",
};

export type Strength = { def: number; mei: number; ata: number; ovr: number };

/** Força média por setor, já com o desconto de quem está fora de posição. */
export function strength(formation: Formation, xi: BaseCard[]): Strength {
  const acc = { def: [] as number[], mei: [] as number[], ata: [] as number[] };
  formation.slots.forEach((s, i) => {
    const c = xi[i];
    if (c) acc[SECTOR[s.role]].push(effective(c, s.role));
  });
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const all = [...acc.def, ...acc.mei, ...acc.ata];
  return { def: avg(acc.def), mei: avg(acc.mei), ata: avg(acc.ata), ovr: avg(all) };
}

/**
 * Escalação automática: preenche primeiro as vagas mais difíceis (goleiro,
 * depois as de menos candidatos) com quem rende mais em cada uma.
 */
export function autoXI(formation: Formation, cards: BaseCard[]): number[] {
  const used = new Set<number>();
  const result: number[] = Array(formation.slots.length).fill(-1);
  const order = formation.slots
    .map((s, i) => ({ i, role: s.role, natural: cards.filter((c) => c.position === s.role).length }))
    .sort((a, b) => (a.role === "GOL" ? -1 : b.role === "GOL" ? 1 : a.natural - b.natural));
  for (const { i, role } of order) {
    let best = -1;
    let bestVal = -1;
    cards.forEach((c, idx) => {
      if (used.has(idx)) return;
      const v = effective(c, role);
      if (v > bestVal) {
        bestVal = v;
        best = idx;
      }
    });
    result[i] = best;
    used.add(best);
  }
  return result;
}
