/**
 * Adversário gerado para amistosos de treino (sem banco de dados).
 * Nome, escudo, camisa, elenco e tática saem de uma seed do clube.
 */
import { hash32, rng, type BaseCard } from "@/lib/cards/generate";
import { RIVAL_CLUBS } from "@/lib/cards/names";
import { DRAFT_SLOTS, draftOption } from "@/lib/cards/squad";
import { kitFromCrest, randomCrest, type Crest, type Kit } from "@/lib/club/identity";
import { autoLineup, defaultLineup, type Lineup } from "@/lib/tactics/lineup";

export type Rival = { id: string; name: string; tag: string; crest: Crest; kit: Kit; squad: BaseCard[]; lineup: Lineup };

export function makeRival(clubId: string, n = 1): Rival {
  const id = `rival:${clubId}:${n}`;
  const r = rng(hash32(id));
  const name = RIVAL_CLUBS[Math.floor(r() * RIVAL_CLUBS.length)];
  const crest = randomCrest(r);
  const kit = kitFromCrest(crest);
  const squad = DRAFT_SLOTS.map((s, i) => draftOption(id, i, Math.floor(r() * s.options)));
  const formation = [0, 1, 6, 9, 3][Math.floor(r() * 5)];
  const lineup = autoLineup({ ...defaultLineup(squad), formation, posture: 1 + Math.floor(r() * 3) }, squad);
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .split(" ")
    .filter(Boolean);
  const initials = words.filter((w) => w.length > 2).map((w) => w[0]).join("");
  const tag = initials.length >= 3 ? initials.slice(0, 3) : words[0].slice(0, 3);
  return { id, name, tag, crest, kit, squad, lineup };
}
