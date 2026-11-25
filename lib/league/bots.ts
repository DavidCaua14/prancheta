/**
 * Times da CPU: ocupam as vagas da liga que ainda não têm técnico.
 * Gerados no aparelho a partir do id da liga e da vaga — sempre iguais.
 */
import { hash32, rng, type BaseCard } from "@/lib/cards/generate";
import { LENDAS_CLUBS, SERIE_A_CLUBS, SERIE_B_CLUBS, SERIE_C_CLUBS, SERIE_D_CLUBS, VARZEA_CLUBS } from "@/lib/cards/names";
import { DRAFT_SLOTS, draftOption } from "@/lib/cards/squad";
import { kitFromCrest, randomCrest, type Crest, type Kit } from "@/lib/club/identity";
import { autoLineup, defaultLineup, type Lineup } from "@/lib/tactics/lineup";
import { divisionInfo } from "./divisions";

export type BotTeam = { name: string; tag: string; crest: Crest; kit: Kit; squad: BaseCard[]; lineup: Lineup };

export function tagOf(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .split(" ")
    .filter(Boolean);
  const initials = words.filter((w) => w.length > 2).map((w) => w[0]).join("");
  if (initials.length >= 3) return initials.slice(0, 3);
  // "EC Vila Serrana" → EVS (antes de cair na 1ª palavra)
  const all = words.map((w) => w[0]).join("");
  return all.length >= 3 ? all.slice(0, 3) : words[0].slice(0, 3);
}

const NAMES: Record<number, string[]> = { 0: VARZEA_CLUBS, 1: SERIE_D_CLUBS, 2: SERIE_C_CLUBS, 3: SERIE_B_CLUBS, 4: SERIE_A_CLUBS, 5: LENDAS_CLUBS };

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
    // divisões acima da D: jogadores mais rodados (+2 por nível)
    const boost = (level - 1) * 2;
    if (boost === 0) return best;
    return { ...best, overall: best.overall + boost, stats: best.stats.map((st) => ({ ...st, value: Math.min(90, st.value + boost) })) };
  });
  const formation = [0, 1, 6, 9, 3, 8][Math.floor(r() * 6)];
  const lineup = autoLineup({ ...defaultLineup(squad), formation, posture: 1 + Math.floor(r() * 3), marking: Math.floor(r() * 3), passing: Math.floor(r() * 3) }, squad);
  const bot = { name, tag: tagOf(name), crest, kit: kitFromCrest(crest), squad, lineup };
  cache.set(key, bot);
  return bot;
}
