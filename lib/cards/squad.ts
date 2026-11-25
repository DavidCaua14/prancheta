/**
 * Peneira (elenco inicial) e codificação do elenco.
 *
 * Vagas: 11 titulares no 4-3-3 (3 opções cada) + 3 reservas (5 opções cada).
 * No banco: "1:" + um dígito por vaga com a opção escolhida.
 */

import { lotCard, wonAt, type WonLot } from "@/lib/auction/lots";
import { evolveSquad } from "./evolution";
import { GENERATOR_VERSION, generateBaseCard, hash32, type BaseCard, type Position } from "./generate";

export type DraftSlot = {
  key: string;
  label: string;
  /** Posições possíveis (reservas sorteiam entre elas). */
  positions: Position[];
  options: number;
  reserve: boolean;
  /** Lugar no campinho (x, y em %, ataque para cima). */
  spot?: [number, number];
};

export const DRAFT_SLOTS: DraftSlot[] = [
  { key: "gol", label: "Goleiro", positions: ["GOL"], options: 3, reserve: false, spot: [50, 90] },
  { key: "zag1", label: "Zagueiro", positions: ["ZAG"], options: 3, reserve: false, spot: [63, 74] },
  { key: "zag2", label: "Zagueiro", positions: ["ZAG"], options: 3, reserve: false, spot: [37, 74] },
  { key: "ld", label: "Lateral-direito", positions: ["LD"], options: 3, reserve: false, spot: [86, 66] },
  { key: "le", label: "Lateral-esquerdo", positions: ["LE"], options: 3, reserve: false, spot: [14, 66] },
  { key: "vol", label: "Volante", positions: ["VOL"], options: 3, reserve: false, spot: [50, 56] },
  { key: "mc", label: "Meia-central", positions: ["MC"], options: 3, reserve: false, spot: [29, 44] },
  { key: "mei", label: "Meia-armador", positions: ["MEI"], options: 3, reserve: false, spot: [71, 44] },
  { key: "pd", label: "Ponta-direita", positions: ["PD"], options: 3, reserve: false, spot: [82, 22] },
  { key: "pe", label: "Ponta-esquerda", positions: ["PE"], options: 3, reserve: false, spot: [18, 22] },
  { key: "ata", label: "Atacante", positions: ["ATA"], options: 3, reserve: false, spot: [50, 14] },
  { key: "res1", label: "Reserva da defesa", positions: ["GOL", "ZAG", "LD", "LE"], options: 5, reserve: true },
  { key: "res2", label: "Reserva do meio", positions: ["VOL", "MC", "MEI"], options: 5, reserve: true },
  { key: "res3", label: "Reserva do ataque", positions: ["PD", "PE", "ATA"], options: 5, reserve: true },
];

export const STARTERS = DRAFT_SLOTS.filter((s) => !s.reserve).length;

/** Opção `option` da vaga `slotIndex` para este clube (sempre a mesma). */
export function draftOption(clubId: string, slotIndex: number, option: number): BaseCard {
  const slot = DRAFT_SLOTS[slotIndex];
  const seed = hash32(`${clubId}:${slot.key}:${option}:v${GENERATOR_VERSION}`);
  const position = slot.positions.length === 1 ? slot.positions[0] : slot.positions[seed % slot.positions.length];
  return generateBaseCard(seed, position, `${slot.key}-${option}`);
}

export function draftOptions(clubId: string, slotIndex: number): BaseCard[] {
  return Array.from({ length: DRAFT_SLOTS[slotIndex].options }, (_, i) => draftOption(clubId, slotIndex, i));
}

export function encodeSquad(picks: number[]): string {
  return `${GENERATOR_VERSION}:${picks.join("")}`;
}

export function decodeSquad(code: string | null | undefined): number[] | null {
  const m = /^1:([0-9]{14})$/.exec(code ?? "");
  if (!m) return null;
  const picks = m[1].split("").map(Number);
  return picks.every((p, i) => p < DRAFT_SLOTS[i].options) ? picks : null;
}

/** Cartas do elenco a partir do código salvo no banco. */
export function squadCards(clubId: string, code: string | null | undefined): BaseCard[] | null {
  const picks = decodeSquad(code);
  return picks ? picks.map((p, i) => draftOption(clubId, i, p)) : null;
}

export function teamOverall(cards: BaseCard[]): number {
  const starters = cards.slice(0, STARTERS);
  return starters.length ? Math.round(starters.reduce((s, c) => s + c.overall, 0) / starters.length) : 0;
}

/**
 * Elenco do clube no instante `at`: as 14 da peneira + as cartas arrematadas
 * no leilão até ali (índices 14, 15, ...), com a evolução (níveis) aplicada.
 */
export function clubCards(
  clubId: string,
  squad: string | null,
  xp: readonly number[] | null | undefined,
  won?: readonly WonLot[] | null,
  at = Number.POSITIVE_INFINITY,
): BaseCard[] {
  const base = squadCards(clubId, squad) ?? [];
  if (!base.length) return base;
  const extra = wonAt(won, at).map((w) => lotCard(w.round, w.idx));
  return evolveSquad([...base, ...extra], xp);
}
