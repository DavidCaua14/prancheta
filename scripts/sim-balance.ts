/**
 * Relatório de equilíbrio do motor de partidas.
 * Uso: npm run sim:balance
 */
import { makeSquadFor, makeTeam } from "../tests/helpers";
import { simulate } from "../lib/sim/engine";
import { FORMATIONS } from "../lib/tactics/formations";
import { defaultLineup } from "../lib/tactics/lineup";
import { headToHead, run, summarize } from "../tests/balance";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const n2 = (x: number) => x.toFixed(2);

const N = Number(process.env.N ?? 4000);
const t0 = performance.now();
const base = summarize(run(N, (i) => makeTeam(`h${i}`), (i) => makeTeam(`a${i}`)));
const ms = performance.now() - t0;

console.log(`\n=== GERAL: ${N} jogos entre times Base sorteados (${(ms / N).toFixed(3)} ms/jogo) ===`);
console.table({
  "gols/jogo": n2(base.goals),
  "gols mandante": n2(base.homeGoals),
  "gols visitante": n2(base.awayGoals),
  "vitória mandante": pct(base.homeWin),
  empate: pct(base.draw),
  "vitória visitante": pct(base.awayWin),
  "0 x 0": pct(base.nilNil),
  "7+ gols": pct(base.bigScore),
  "maior placar (soma)": base.maxGoals,
  "chutes/time": n2(base.shots),
  "% no alvo": pct(base.onTargetRate),
  "amarelos/jogo": n2(base.yellows),
  "vermelhos/jogo": n2(base.reds),
  "pênaltis/jogo": n2(base.penalties),
  "substituições/time": n2(base.subs),
  "posse mandante": `${base.possessionHome.toFixed(1)}%`,
});

const H = Math.round(N / 2);
console.log(`\n=== FORÇA (mesmo elenco, +X de overall, mando alternado, ${H} jogos cada) ===`);
const strength: Record<string, unknown> = {};
for (const d of [0, 2, 5, 10, 20, 30]) {
  const r = headToHead(H, { shift: d }, {}, 10 + d);
  strength[`+${d}`] = { vitória: pct(r.win), empate: pct(r.draw), derrota: pct(r.loss), "gols pró": n2(r.gf), "gols contra": n2(r.ga) };
}
console.table(strength);

console.log(`\n=== POSTURA (contra o mesmo time Equilibrado) ===`);
const posture: Record<string, unknown> = {};
["Retranca", "Defensiva", "Equilibrada", "Ofensiva", "Tudo pra frente"].forEach((name, p) => {
  const r = headToHead(H, { lineup: { posture: p } }, {}, 20 + p);
  posture[name] = { vitória: pct(r.win), empate: pct(r.draw), derrota: pct(r.loss), "gols/jogo": n2(r.goals) };
});
console.table(posture);

console.log(`\n=== RETRANCA contra time 8 pontos mais forte ===`);
const under: Record<string, unknown> = {};
["Retranca", "Defensiva", "Equilibrada", "Ofensiva", "Tudo pra frente"].forEach((name, p) => {
  const r = headToHead(H, { lineup: { posture: p } }, { shift: 8 }, 30 + p);
  under[name] = { vitória: pct(r.win), empate: pct(r.draw), derrota: pct(r.loss), "pontos/jogo": n2(r.win * 3 + r.draw) };
});
console.table(under);

console.log(`\n=== MARCAÇÃO ===`);
const marking: Record<string, unknown> = {};
["Leve", "Normal", "Pressão"].forEach((name, m) => {
  const res = run(H, (i) => makeTeam(`m${i}`, { lineup: { marking: m } }), (i) => makeTeam(`m${i}`), { seed: 40 + m });
  const r = headToHead(H, { lineup: { marking: m } }, {}, 40 + m);
  const y = res.reduce((s, x) => s + x.stats[0].yellows, 0) / res.length;
  marking[name] = { vitória: pct(r.win), derrota: pct(r.loss), "amarelos do time/jogo": n2(y) };
});
console.table(marking);

console.log(`\n=== PASSES x PERFIL DO ELENCO ===`);
const passes: Record<string, unknown> = {};
const profiles = { Técnico: { PAS: 10, DRI: 10, VEL: -8, FÍS: -8 }, Rápido: { VEL: 10, FÍS: 10, PAS: -8, DRI: -8 } };
for (const [pname, bias] of Object.entries(profiles)) {
  ["Toque curto", "Misto", "Ligação direta"].forEach((name, s) => {
    const r = headToHead(H, { bias, lineup: { passing: s } }, {}, 50 + s + (pname === "Rápido" ? 10 : 0));
    passes[`${pname} · ${name}`] = { vitória: pct(r.win), derrota: pct(r.loss), "saldo/jogo": n2(r.gf - r.ga) };
  });
}
console.table(passes);

console.log(`\n=== FORMAÇÕES (elenco montado para cada uma, contra 4-3-3; ${H} jogos) ===`);
const forms: Record<string, unknown> = {};
for (const f of FORMATIONS) {
  if (f.id === 0) continue;
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (let i = 0; i < H; i++) {
    const sa = makeSquadFor(`f${i}`, f.id);
    const sb = makeSquadFor(`g${i}`, 0);
    const xi = Array.from({ length: 11 }, (_, k) => k);
    const A = { name: "A", short: "AAA", squad: sa, ai: true, lineup: { ...defaultLineup(sa), formation: f.id, xi } };
    const B = { name: "B", short: "BBB", squad: sb, ai: true, lineup: { ...defaultLineup(sb), formation: 0, xi } };
    const home = i % 2 === 0;
    const r = simulate({ seed: 900 + i * 7919 + f.id, home: home ? A : B, away: home ? B : A });
    const [x, y] = home ? r.score : [r.score[1], r.score[0]];
    gf += x; ga += y;
    if (x > y) w++; else if (x === y) d++; else l++;
  }
  forms[`${f.name}${f.nick ? " " + f.nick : ""}`] = { vitória: pct(w / H), empate: pct(d / H), derrota: pct(l / H), "gols pró": n2(gf / H), "gols contra": n2(ga / H) };
}
console.table(forms);
