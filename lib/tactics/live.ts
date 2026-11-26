/**
 * Mudanças táticas durante a partida (liga, copas, amistosos e treino):
 * os grupos de ajuste e o valor de cada um num minuto, a partir da escalação
 * + mudanças gravadas ("p4", "l2", "w0", "t1").
 */
import type { ChangeRow } from "@/lib/league/core";
import { LINES, POSTURES, TEMPOS, WIDTHS, type Lineup } from "./lineup";

export type TacticLetter = "p" | "l" | "w" | "t";
export const TACTIC_LETTERS: TacticLetter[] = ["p", "l", "w", "t"];

/** Nome do grupo, nome curto (para "linha adiantada") e opções. */
export const TACTIC_GROUPS: Record<TacticLetter, { label: string; short: string; options: readonly { label: string; hint: string }[] }> = {
  p: { label: "Postura", short: "postura", options: POSTURES },
  l: { label: "Linha defensiva", short: "linha", options: LINES },
  w: { label: "Jogo", short: "jogo", options: WIDTHS },
  t: { label: "Ritmo", short: "ritmo", options: TEMPOS },
};

/** Valor de cada ajuste do clube até o minuto `upTo` (Infinity = com tudo o que já foi agendado). */
export function tacticAt(changes: readonly ChangeRow[], round: number, clubId: string | undefined, lineup: Lineup, upTo: number): Record<TacticLetter, number> {
  const v: Record<TacticLetter, number> = { p: lineup.posture, l: lineup.line ?? 1, w: lineup.width ?? 1, t: lineup.tempo ?? 1 };
  if (!clubId) return v;
  const mine = changes.filter((c) => c.round === round && c.club_id === clubId && c.tick <= upTo).sort((a, b) => a.tick - b.tick);
  for (const c of mine) {
    const l = c.change[0] as TacticLetter;
    if (TACTIC_LETTERS.includes(l)) v[l] = Number(c.change[1]);
  }
  return v;
}
