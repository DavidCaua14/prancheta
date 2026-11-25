/** Montagem de times para os testes do motor. */
import type { BaseCard } from "@/lib/cards/generate";
import { generateBaseCard, hash32 } from "@/lib/cards/generate";
import { draftOption, DRAFT_SLOTS } from "@/lib/cards/squad";
import { FORMATIONS } from "@/lib/tactics/formations";
import { autoLineup, defaultLineup, type Lineup } from "@/lib/tactics/lineup";
import type { TeamInput } from "@/lib/sim/engine";

export type Bias = { [label: string]: number };

/**
 * Elenco de 14 cartas (mesma estrutura da peneira), com o overall deslocado
 * em `shift` pontos e vieses opcionais em atributos (ex.: { PAS: 8 }).
 */
export function makeSquad(id: string, shift = 0, bias: Bias = {}): BaseCard[] {
  return DRAFT_SLOTS.map((_, i) => {
    const c = draftOption(id, i, 0);
    return {
      ...c,
      overall: c.overall + shift,
      stats: c.stats.map((s) => ({ ...s, value: s.value + shift + (bias[s.label] ?? 0) })),
    };
  });
}

/** Elenco com os 11 nas posições da formação + 3 reservas (GOL, ZAG, MC). */
export function makeSquadFor(id: string, formation: number, shift = 0): BaseCard[] {
  const roles = [...FORMATIONS[formation].slots.map((s) => s.role), "GOL", "ZAG", "MC"] as const;
  return roles.map((role, i) => {
    const c = generateBaseCard(hash32(`${id}:${i}`), role, `${id}-${i}`);
    return { ...c, overall: c.overall + shift, stats: c.stats.map((s) => ({ ...s, value: s.value + shift })) };
  });
}

export function makeTeam(id: string, opts: { shift?: number; bias?: Bias; lineup?: Partial<Lineup>; ai?: boolean } = {}): TeamInput {
  const squad = makeSquad(id, opts.shift ?? 0, opts.bias ?? {});
  return {
    name: `Time ${id}`,
    short: id.slice(0, 3).toUpperCase(),
    squad,
    lineup:
      opts.lineup?.formation !== undefined && opts.lineup.xi === undefined
        ? autoLineup({ ...defaultLineup(squad), ...opts.lineup }, squad)
        : { ...defaultLineup(squad), ...opts.lineup },
    ai: opts.ai ?? true,
  };
}
