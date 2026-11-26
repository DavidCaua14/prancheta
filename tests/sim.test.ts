/**
 * Testes do motor de partidas: regras, determinismo e equilíbrio.
 * Rodar: npm test
 *
 * Os intervalos de equilíbrio têm folga para o ruído estatístico; se um
 * ajuste no motor tirar algum número da faixa, o teste avisa.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, type MatchInput } from "@/lib/sim/engine";
import { makeTeam } from "./helpers";
import { headToHead, run, summarize } from "./balance";

const between = (x: number, lo: number, hi: number, what: string) =>
  assert.ok(x >= lo && x <= hi, `${what}: ${x.toFixed(3)} fora da faixa [${lo}, ${hi}]`);

const match = (seed = 42, extra: Partial<MatchInput> = {}): MatchInput => ({
  seed,
  home: makeTeam("casa"),
  away: makeTeam("fora"),
  ...extra,
});

/* ------------------------------------------------------------------ */
/* Regras                                                              */
/* ------------------------------------------------------------------ */

test("determinístico: mesma seed, mesma partida", () => {
  const a = simulate(match(123));
  const b = simulate(match(123));
  assert.deepEqual(a, b);
  const c = simulate(match(124));
  assert.notDeepEqual(a.events.map((e) => e.text), c.events.map((e) => e.text));
});

test("mudança no minuto 60 não altera nada antes do minuto 60", () => {
  const base = simulate(match(7));
  const changed = simulate(match(7, { changes: [{ minute: 60, team: 0, kind: "tactic", posture: 4 }] }));
  const before = (r: typeof base) => r.events.filter((e) => e.tick < 60).map((e) => `${e.tick}${e.type}${e.text}`);
  assert.deepEqual(before(changed), before(base));
  assert.ok(changed.events.some((e) => e.type === "tactic" && e.tick === 60));
});

test("placar bate com os gols narrados e estrutura do jogo é válida", () => {
  for (let s = 0; s < 300; s++) {
    const r = simulate(match(s));
    const goals = [0, 0];
    for (const e of r.events) if (e.type === "goal" || e.type === "penalty_goal") goals[e.team!]++;
    assert.deepEqual(goals, r.score);
    assert.equal(r.events[0].type, "kickoff");
    assert.equal(r.events.at(-1)!.type, "fulltime");
    assert.equal(r.events.filter((e) => e.type === "halftime").length, 1);
    assert.ok(r.length >= 93 && r.length <= 98);
    assert.equal(r.stats[0].possession + r.stats[1].possession, 100);
    for (const t of r.stats) {
      assert.ok(t.onTarget <= t.shots);
      assert.ok(t.subs <= 5);
    }
    // eventos em ordem
    for (let i = 1; i < r.events.length; i++) assert.ok(r.events[i].tick >= r.events[i - 1].tick);
  }
});

test("substituição: só reserva entra, respeita o limite e quem saiu não volta", () => {
  const home = makeTeam("subs", { ai: false });
  const bench = home.squad.map((_, i) => i).filter((i) => !home.lineup.xi.includes(i));
  const r = simulate({
    seed: 5,
    home,
    away: makeTeam("adv", { ai: false }),
    changes: [
      { minute: 46, team: 0, kind: "sub", out: home.lineup.xi[10], in: bench[2] },
      { minute: 50, team: 0, kind: "sub", out: home.lineup.xi[9], in: home.lineup.xi[10] }, // inválida: já saiu
      { minute: 55, team: 0, kind: "sub", out: home.lineup.xi[9], in: home.lineup.xi[3] }, // inválida: titular
    ],
  });
  const subs = r.events.filter((e) => e.type === "sub" && e.team === 0);
  assert.ok(subs.length >= 1);
  assert.equal(subs[0].player, bench[2]);
  assert.ok(!subs.some((e) => e.player === home.lineup.xi[10] || e.player === home.lineup.xi[3]));
});

test("notas entre 3 e 10 e só para quem entrou em campo", () => {
  const r = simulate(match(99));
  for (const side of r.ratings) {
    const entries = Object.values(side);
    assert.ok(entries.length >= 11 && entries.length <= 16);
    for (const n of entries) assert.ok(n >= 3 && n <= 10);
  }
});

test("rápido: 2.000 partidas em menos de 4 segundos", () => {
  const t0 = performance.now();
  run(2000, (i) => makeTeam(`p${i}`), (i) => makeTeam(`q${i}`));
  assert.ok(performance.now() - t0 < 4000);
});

/* ------------------------------------------------------------------ */
/* Equilíbrio                                                          */
/* ------------------------------------------------------------------ */

test("números gerais parecidos com o futebol real", () => {
  const s = summarize(run(2500, (i) => makeTeam(`h${i}`), (i) => makeTeam(`a${i}`)));
  between(s.goals, 2.3, 3.2, "gols por jogo");
  between(s.homeWin, 0.39, 0.51, "vitória do mandante");
  between(s.draw, 0.2, 0.31, "empates");
  between(s.awayWin, 0.24, 0.36, "vitória do visitante");
  between(s.nilNil, 0.03, 0.11, "0 x 0");
  between(s.bigScore, 0, 0.05, "jogos com 7+ gols");
  between(s.shots, 9, 16, "chutes por time");
  between(s.onTargetRate, 0.28, 0.45, "chutes no alvo");
  between(s.yellows, 2, 5, "amarelos por jogo");
  between(s.reds, 0.05, 0.3, "vermelhos por jogo");
  between(s.penalties, 0.1, 0.45, "pênaltis por jogo");
});

test("time mais forte vence mais, mas com zebras", () => {
  const same = headToHead(1500, {}, {}, 1);
  between(same.win - same.loss, -0.06, 0.06, "times iguais: vitórias - derrotas");
  const plus5 = headToHead(1500, { shift: 5 }, {}, 2);
  between(plus5.win, 0.46, 0.66, "+5 de overall: vitórias");
  assert.ok(plus5.loss > 0.12, "+5 ainda precisa perder às vezes");
  const plus10 = headToHead(1500, { shift: 10 }, {}, 3);
  between(plus10.win, 0.62, 0.84, "+10 de overall: vitórias");
  const plus20 = headToHead(1500, { shift: 20 }, {}, 4);
  assert.ok(plus20.win > 0.85, "+20 de overall deve vencer quase sempre");
});

test("nenhuma postura é sempre melhor; ofensiva = mais gols, retranca = menos", () => {
  const goals: number[] = [];
  for (let p = 0; p <= 4; p++) {
    const r = headToHead(1500, { lineup: { posture: p } }, {}, 20 + p);
    goals.push(r.goals);
    between(r.win - r.loss, -0.12, 0.08, `postura ${p}: vitórias - derrotas contra Equilibrada`);
  }
  for (let p = 1; p <= 4; p++) assert.ok(goals[p] > goals[p - 1], "postura mais ofensiva deve ter mais gols no jogo");
});

test("retranca ajuda o time mais fraco a segurar o resultado", () => {
  const ret = headToHead(2000, { lineup: { posture: 0 } }, { shift: 8 }, 31);
  const all = headToHead(2000, { lineup: { posture: 4 } }, { shift: 8 }, 31);
  assert.ok(ret.loss < all.loss - 0.04, "retranca deve perder menos que o tudo pra frente contra time mais forte");
  assert.ok(ret.draw > all.draw + 0.05, "retranca deve empatar mais");
});

test("marcação: pressão dá mais cartões e não é desequilibrada", () => {
  const cards = (m: number) => run(1000, (i) => makeTeam(`m${i}`, { lineup: { marking: m } }), (i) => makeTeam(`n${i}`), { seed: 50 + m }).reduce((s, x) => s + x.stats[0].yellows, 0) / 1000;
  assert.ok(cards(2) > cards(1) * 1.4 && cards(1) > cards(0) * 1.3, "pressão > normal > leve em cartões");
  const press = headToHead(1500, { lineup: { marking: 2 } }, {}, 41);
  between(press.win - press.loss, -0.08, 0.1, "pressão: vitórias - derrotas");
});

test("estilo de passe combina com o perfil do elenco", () => {
  const tech = { PAS: 10, DRI: 10, VEL: -8, FÍS: -8 };
  const fast = { VEL: 10, FÍS: 10, PAS: -8, DRI: -8 };
  const techShort = headToHead(1500, { bias: tech, lineup: { passing: 0 } }, {}, 51);
  const techLong = headToHead(1500, { bias: tech, lineup: { passing: 2 } }, {}, 51);
  assert.ok(techShort.gf - techShort.ga > techLong.gf - techLong.ga + 0.2, "time técnico rende mais no toque curto");
  const fastShort = headToHead(1500, { bias: fast, lineup: { passing: 0 } }, {}, 61);
  const fastLong = headToHead(1500, { bias: fast, lineup: { passing: 2 } }, {}, 61);
  assert.ok(fastLong.gf - fastLong.ga > fastShort.gf - fastShort.ga + 0.1, "time rápido rende mais na ligação direta");
});

test("jogador fora de posição atrapalha", () => {
  // troca o goleiro com o atacante: os dois improvisados
  const normal = headToHead(1200, {}, {}, 71);
  const team = makeTeam("x");
  const xi = [...team.lineup.xi];
  [xi[0], xi[10]] = [xi[10], xi[0]];
  const swapped = headToHead(1200, { lineup: { xi } }, {}, 71);
  assert.ok(swapped.loss > normal.loss + 0.15, "goleiro na linha e atacante no gol deve perder bem mais");
});

test("várias mudanças táticas no mesmo minuto: um lance só, dizendo tudo o que mudou", () => {
  const base: MatchInput = { seed: 77, home: makeTeam("aaa"), away: makeTeam("bbb") };
  const one = simulate({ ...base, changes: [{ minute: 30, team: 0, kind: "tactic", posture: 4 }] });
  const many = simulate({
    ...base,
    changes: [
      { minute: 30, team: 0, kind: "tactic", posture: 4 },
      { minute: 30, team: 0, kind: "tactic", line: 2 },
      { minute: 30, team: 0, kind: "tactic", tempo: 2 },
    ],
  });
  const t1 = one;
  const tm = many;
  const tac = (r: typeof t1) => r.events.filter((e) => e.type === "tactic" && e.team === 0 && e.tick === 30);
  assert.equal(tac(t1).length, 1);
  assert.match(tac(t1)[0].text, /muda a postura: Tudo pra frente/);
  assert.equal(tac(tm).length, 1);
  assert.match(tac(tm)[0].text, /muda a tática: Tudo pra frente, linha adiantada e ritmo acelerado/);
  // juntar as mudanças numa só (como no treino) dá o mesmo jogo
  const merged = simulate({ ...base, changes: [{ minute: 30, team: 0, kind: "tactic", posture: 4, line: 2, tempo: 2 }] });
  assert.deepEqual(merged.score, tm.score);
  assert.equal(merged.events.length, tm.events.length);
});

test("tática em vigor e agendada (liga/copa/amistoso)", async () => {
  const { tacticAt } = await import("@/lib/tactics/live");
  const lineup = makeTeam("ccc").lineup;
  const rows = [
    { round: 1, club_id: "x", tick: 20, change: "p4" },
    { round: 1, club_id: "x", tick: 40, change: "l2" },
    { round: 1, club_id: "x", tick: 40, change: "p1" },
    { round: 1, club_id: "y", tick: 10, change: "t2" },
    { round: 2, club_id: "x", tick: 5, change: "w0" },
  ];
  assert.deepEqual(tacticAt(rows, 1, "x", lineup, 10), { p: lineup.posture, l: lineup.line ?? 1, w: lineup.width ?? 1, t: lineup.tempo ?? 1 });
  assert.equal(tacticAt(rows, 1, "x", lineup, 30).p, 4);
  const planned = tacticAt(rows, 1, "x", lineup, Number.POSITIVE_INFINITY);
  assert.equal(planned.p, 1);
  assert.equal(planned.l, 2);
  assert.equal(planned.t, lineup.tempo ?? 1);
});
