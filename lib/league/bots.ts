/**
 * Times da CPU: ocupam as vagas da liga que ainda não têm técnico.
 * Gerados no aparelho a partir do id da liga e da vaga — sempre iguais.
 */
import { hash32, rng, type BaseCard } from "@/lib/cards/generate";
import { SERIE_D_CLUBS, VARZEA_CLUBS } from "@/lib/cards/names";
import { DRAFT_SLOTS, draftOption } from "@/lib/cards/squad";
import { kitFromCrest, randomCrest, type Crest, type Kit } from "@/lib/club/identity";
import { autoLineup, defaultLineup, type Lineup } from "@/lib/tactics/lineup";
import { divisionInfo } from "./divisions";

export type BotTeam = { name: string; tag: string; crest: Crest; kit: Kit; squad: BaseCard[]; lineup: Lineup };

function tagOf(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .split(" ")
    .filter(Boolean);
  const initials = words.filter((w) => w.length > 2).map((w) => w[0]).join("");
  return initials.length >= 3 ? initials.slice(0, 3) : words[0].slice(0, 3);
}

const NAMES: Record<number, string[]> = { 0: VARZEA_CLUBS, 1: SERIE_D_CLUBS };

/** Ordem embaralhada dos nomes para a liga (sem repetir entre as vagas). */
function namesFor(leagueId: number, division: number): string[] {
  const r = rng(hash32(`liga:${leagueId}:nomes`));
  const list = [...(NAMES[division] ?? VARZEA_CLUBS)];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const cache = new Map<string, BotTeam>();

/**
 * ⚠️ A Várzea (division 0) precisa continuar gerando exatamente os mesmos
 * times de sempre: ligas antigas são recalculadas a partir daqui.
 */
export function botTeam(leagueId: number, slot: number, division = 0): BotTeam {
  const key = `${leagueId}:${slot}:${division}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const id = `bot:${leagueId}:${slot}`;
  const r = rng(hash32(id));
  const names = namesFor(leagueId, division);
  const name = names[slot % names.length];
  const crest = randomCrest(r);
  const level = divisionInfo(division).botLevel;
  const squad = DRAFT_SLOTS.map((s, i) => {
    const pick = Math.floor(r() * s.options);
    if (level < 1) return draftOption(id, i, pick);
    // divisões acima: a CPU escolhe a melhor carta da peneira em cada posição
    let best = draftOption(id, i, 0);
    for (let o = 1; o < s.options; o++) {
      const c = draftOption(id, i, o);
      if (c.overall > best.overall) best = c;
    }
    return best;
  });
  const formation = [0, 1, 6, 9, 3, 8][Math.floor(r() * 6)];
  const lineup = autoLineup({ ...defaultLineup(squad), formation, posture: 1 + Math.floor(r() * 3), marking: Math.floor(r() * 3), passing: Math.floor(r() * 3) }, squad);
  const bot = { name, tag: tagOf(name), crest, kit: kitFromCrest(crest), squad, lineup };
  cache.set(key, bot);
  return bot;
}
