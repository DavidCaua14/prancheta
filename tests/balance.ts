/**
 * Métricas de equilíbrio do motor — usadas pelos testes e pelo relatório
 * (`npm run sim:balance`).
 */
import { simulate, type MatchResult, type TeamInput } from "@/lib/sim/engine";
import { makeTeam, type Bias } from "./helpers";
import type { Lineup } from "@/lib/tactics/lineup";

export type Summary = {
  n: number;
  goals: number;
  homeGoals: number;
  awayGoals: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  nilNil: number;
  bigScore: number;
  shots: number;
  onTargetRate: number;
  yellows: number;
  reds: number;
  penalties: number;
  subs: number;
  possessionHome: number;
  maxGoals: number;
};

export function summarize(results: MatchResult[]): Summary {
  const n = results.length;
  const s = { goals: 0, hg: 0, ag: 0, hw: 0, d: 0, aw: 0, nn: 0, big: 0, shots: 0, on: 0, y: 0, rd: 0, pen: 0, subs: 0, pos: 0, max: 0 };
  for (const r of results) {
    const [h, a] = r.score;
    s.goals += h + a;
    s.hg += h;
    s.ag += a;
    if (h > a) s.hw++;
    else if (h === a) s.d++;
    else s.aw++;
    if (h + a === 0) s.nn++;
    if (h + a >= 7) s.big++;
    s.max = Math.max(s.max, h + a);
    for (const t of r.stats) {
      s.shots += t.shots;
      s.on += t.onTarget;
      s.y += t.yellows;
      s.rd += t.reds;
      s.subs += t.subs;
    }
    s.pos += r.stats[0].possession;
    s.pen += r.events.filter((e) => e.type === "penalty_goal" || e.type === "penalty_miss").length;
  }
  return {
    n,
    goals: s.goals / n,
    homeGoals: s.hg / n,
    awayGoals: s.ag / n,
    homeWin: s.hw / n,
    draw: s.d / n,
    awayWin: s.aw / n,
    nilNil: s.nn / n,
    bigScore: s.big / n,
    shots: s.shots / (2 * n),
    onTargetRate: s.on / Math.max(1, s.shots),
    yellows: s.y / n,
    reds: s.rd / n,
    penalties: s.pen / n,
    subs: s.subs / (2 * n),
    possessionHome: s.pos / n,
    maxGoals: s.max,
  };
}

/** Roda `n` partidas entre times sorteados (ids diferentes a cada jogo). */
export function run(
  n: number,
  home: (i: number) => TeamInput,
  away: (i: number) => TeamInput,
  opts: { neutral?: boolean; seed?: number } = {},
): MatchResult[] {
  const out: MatchResult[] = [];
  for (let i = 0; i < n; i++) {
    out.push(simulate({ seed: (opts.seed ?? 7777) + i * 7919, home: home(i), away: away(i), neutral: opts.neutral }));
  }
  return out;
}

export type Side = { shift?: number; bias?: Bias; lineup?: Partial<Lineup> };

/**
 * Taxa de vitória/empate/derrota do lado A contra o lado B, alternando o
 * mando (metade em casa, metade fora) e usando o MESMO elenco base nos dois
 * lados — assim só a diferença testada (força, tática…) importa.
 */
export function headToHead(n: number, A: Side, B: Side, seed = 1) {
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  for (let i = 0; i < n; i++) {
    const id = `h2h${seed}-${i}`;
    const a = makeTeam(id, A);
    const b = makeTeam(id, B);
    const home = i % 2 === 0;
    const res = simulate({ seed: seed * 100003 + i * 7919, home: home ? a : b, away: home ? b : a });
    const [x, y] = home ? res.score : [res.score[1], res.score[0]];
    gf += x;
    ga += y;
    if (x > y) w++;
    else if (x === y) d++;
    else l++;
  }
  return { win: w / n, draw: d / n, loss: l / n, gf: gf / n, ga: ga / n, goals: (gf + ga) / n };
}
