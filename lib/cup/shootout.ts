/**
 * Disputa de pênaltis (jogos de copa que terminam empatados).
 * Determinística: mesma seed + mesmos jogadores em campo = mesmas cobranças.
 * Usa uma seed própria, separada do jogo — o placar dos 90 minutos não muda.
 */
import { rng, type BaseCard } from "@/lib/cards/generate";
import type { MatchEvent } from "@/lib/sim/engine";
import { FORMATIONS } from "@/lib/tactics/formations";
import type { Lineup } from "@/lib/tactics/lineup";

export type Kick = { side: 0 | 1; player: number; scored: boolean };
export type Shootout = { kicks: Kick[]; score: [number, number]; winner: 0 | 1 };

const stat = (c: BaseCard, label: string) => c.stats.find((s) => s.label === label)?.value ?? c.overall;

/** Quem terminou o jogo em campo (aplica substituições e expulsões do lado `side`). */
function onField(lineup: Lineup, events: MatchEvent[], side: 0 | 1): number[] {
  const field = [...lineup.xi];
  for (const e of events) {
    if (e.team !== side) continue;
    if (e.type === "sub" && e.player !== undefined && e.other !== undefined) {
      const k = field.indexOf(e.other);
      if (k >= 0) field[k] = e.player;
    }
    if ((e.type === "red" || e.type === "injury") && e.player !== undefined) {
      const k = field.indexOf(e.player);
      if (k >= 0 && e.type === "red") field[k] = -1;
    }
  }
  return field;
}

function keeper(lineup: Lineup, field: number[], squad: BaseCard[]) {
  const slot = FORMATIONS[lineup.formation].slots.findIndex((s) => s.role === "GOL");
  const gk = field[slot];
  if (gk !== undefined && gk >= 0) return squad[gk];
  // sem goleiro em campo: o pior "goleiro" possível
  return { ...squad[0], stats: squad[0].stats.map((s) => ({ ...s, value: 20 })) };
}

export function shootout(
  seed: number,
  teams: [{ squad: BaseCard[]; lineup: Lineup }, { squad: BaseCard[]; lineup: Lineup }],
  events: MatchEvent[],
): Shootout {
  const r = rng(seed);
  const fields = [onField(teams[0].lineup, events, 0), onField(teams[1].lineup, events, 1)];
  const gks = [keeper(teams[0].lineup, fields[0], teams[0].squad), keeper(teams[1].lineup, fields[1], teams[1].squad)];
  // batedores: quem está em campo (fora o goleiro), melhor finalização primeiro
  const takers = [0, 1].map((t) => {
    const gkSlot = FORMATIONS[teams[t].lineup.formation].slots.findIndex((s) => s.role === "GOL");
    return fields[t]
      .filter((c, k) => c >= 0 && k !== gkSlot)
      .sort((a, b) => stat(teams[t].squad[b], "FIN") - stat(teams[t].squad[a], "FIN") || a - b);
  });
  const kicks: Kick[] = [];
  const score: [number, number] = [0, 0];
  const taken = [0, 0];
  const kick = (side: 0 | 1) => {
    const list = takers[side].length ? takers[side] : [fields[side].find((c) => c >= 0) ?? 0];
    const player = list[taken[side] % list.length];
    const fin = stat(teams[side].squad[player], "FIN");
    const ref = stat(gks[1 - side], "REF");
    const p = Math.min(0.92, Math.max(0.5, 0.74 + (fin - ref) / 150));
    const scored = r() < p;
    taken[side]++;
    if (scored) score[side]++;
    kicks.push({ side, player, scored });
  };
  // 5 cobranças para cada lado, parando quando não dá mais para alcançar
  for (let i = 0; i < 5; i++) {
    for (const side of [0, 1] as const) {
      kick(side);
      const left = [5 - taken[0], 5 - taken[1]];
      if (score[0] + left[0] < score[1] || score[1] + left[1] < score[0]) break;
    }
    const left = [5 - taken[0], 5 - taken[1]];
    if (score[0] + left[0] < score[1] || score[1] + left[1] < score[0]) break;
  }
  // morte súbita
  for (let i = 0; score[0] === score[1] && i < 20; i++) {
    kick(0);
    kick(1);
  }
  if (score[0] === score[1]) score[r() < 0.5 ? 0 : 1]++;
  return { kicks, score, winner: score[0] > score[1] ? 0 : 1 };
}
