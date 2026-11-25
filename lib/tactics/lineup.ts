/**
 * Escalação + tática, guardadas no banco como um código curto:
 *   v1  "1:F:XXXXXXXXXXX:PMS:CK"   — 1 caractere base 36 por jogador (elenco até 36 cartas)
 *   v2  "2:F:XX×11:PMS:CCKK"        — 2 caracteres por jogador (elenco até 1.296 cartas)
 * Elencos pequenos continuam em v1 (códigos antigos seguem valendo).
 * Validação no banco: lineup_ok() (supabase/migrations/0013_unlimited_cards.sql).
 */

import type { BaseCard } from "@/lib/cards/generate";
import { FORMATIONS, autoXI } from "./formations";

export const POSTURES = [
  { label: "Retranca", hint: "Todo mundo atrás. Sofre pouco, ataca quase nada." },
  { label: "Defensiva", hint: "Prioriza a defesa e sai com cuidado." },
  { label: "Equilibrada", hint: "Nem lá, nem cá. O padrão." },
  { label: "Ofensiva", hint: "Sobe a marcação e arrisca mais." },
  { label: "Tudo pra frente", hint: "Pressão total. Bom para buscar o resultado, perigoso no contra-ataque." },
] as const;

export const MARKINGS = [
  { label: "Leve", hint: "Poupa energia e evita cartões." },
  { label: "Normal", hint: "Marcação padrão." },
  { label: "Pressão", hint: "Rouba mais bolas, cansa mais e leva mais cartões." },
] as const;

export const PASSES = [
  { label: "Toque curto", hint: "Valoriza passe e drible. Bom para times técnicos." },
  { label: "Misto", hint: "Mistura toque e bola longa." },
  { label: "Ligação direta", hint: "Bola longa para os atacantes. Bom para times rápidos e fortes." },
] as const;

export type Lineup = {
  formation: number;
  /** índice da carta no elenco para cada vaga da formação */
  xi: number[];
  posture: number;
  marking: number;
  passing: number;
  captain: number;
  penalty: number;
};

const b36 = (n: number) => n.toString(36);

const b36x2 = (n: number) => n.toString(36).padStart(2, "0");

export function encodeLineup(l: Lineup): string {
  const tactic = `${l.posture}${l.marking}${l.passing}`;
  if (Math.max(...l.xi, l.captain, l.penalty) < 36) {
    return `1:${b36(l.formation)}:${l.xi.map(b36).join("")}:${tactic}:${b36(l.captain)}${b36(l.penalty)}`;
  }
  return `2:${b36(l.formation)}:${l.xi.map(b36x2).join("")}:${tactic}:${b36x2(l.captain)}${b36x2(l.penalty)}`;
}

export function decodeLineup(code: string | null | undefined, squadSize: number): Lineup | null {
  const m =
    /^1:([0-9a-z]):([0-9a-z]{11}):([0-4])([0-2])([0-2]):([0-9a-z])([0-9a-z])$/.exec(code ?? "") ??
    /^2:([0-9a-z]):([0-9a-z]{22}):([0-4])([0-2])([0-2]):([0-9a-z]{2})([0-9a-z]{2})$/.exec(code ?? "");
  if (!m) return null;
  const w = m[2].length / 11;
  const xi = Array.from({ length: 11 }, (_, i) => parseInt(m[2].slice(i * w, i * w + w), 36));
  if (new Set(xi).size !== 11 || xi.some((i) => i >= squadSize)) return null;
  const captain = parseInt(m[6], 36);
  const penalty = parseInt(m[7], 36);
  if (!xi.includes(captain) || !xi.includes(penalty)) return null;
  const formation = parseInt(m[1], 36);
  if (formation >= FORMATIONS.length) return null;
  return { formation, xi, posture: +m[3], marking: +m[4], passing: +m[5], captain, penalty };
}

/** Capitão: maior overall. Pênaltis: melhor finalização (fora o goleiro). */
export function pickLeaders(xi: number[], cards: BaseCard[]) {
  const starters = xi.map((i) => ({ i, c: cards[i] }));
  const captain = starters.reduce((a, b) => (b.c.overall > a.c.overall ? b : a)).i;
  const shooters = starters.filter((s) => s.c.position !== "GOL");
  const fin = (c: BaseCard) => c.stats.find((s) => s.label === "FIN")?.value ?? 0;
  const penalty = shooters.reduce((a, b) => (fin(b.c) > fin(a.c) ? b : a)).i;
  return { captain, penalty };
}

/** Escalação inicial: o 4-3-3 da peneira, na ordem em que os jogadores foram escolhidos. */
export function defaultLineup(cards: BaseCard[]): Lineup {
  const xi = Array.from({ length: 11 }, (_, i) => i);
  return { formation: 0, xi, posture: 2, marking: 1, passing: 1, ...pickLeaders(xi, cards) };
}

/** Melhor escalação possível para a formação atual, com todo o elenco. */
export function autoLineup(l: Lineup, cards: BaseCard[]): Lineup {
  const xi = autoXI(FORMATIONS[l.formation], cards);
  return { ...l, xi, ...pickLeaders(xi, cards) };
}

/** Lê a escalação salva ou cai na padrão. */
export function lineupFor(code: string | null | undefined, cards: BaseCard[]): Lineup {
  return decodeLineup(code, cards.length) ?? defaultLineup(cards);
}

/** Troca de formação mantendo os mesmos 11, cada um na vaga em que rende mais. */
export function withFormation(l: Lineup, formation: number, cards: BaseCard[]): Lineup {
  const pool = l.xi.map((i) => cards[i]);
  const xi = autoXI(FORMATIONS[formation], pool).map((k) => l.xi[k]);
  const keepCaptain = xi.includes(l.captain);
  const keepPenalty = xi.includes(l.penalty);
  const leaders = pickLeaders(xi, cards);
  return {
    ...l,
    formation,
    xi,
    captain: keepCaptain ? l.captain : leaders.captain,
    penalty: keepPenalty ? l.penalty : leaders.penalty,
  };
}
