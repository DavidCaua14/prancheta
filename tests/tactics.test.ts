/**
 * Ajustes táticos de linha, jogo e ritmo: cada opção precisa render MAIS
 * quando o elenco encaixa e MENOS quando não encaixa — e nenhuma pode
 * dominar num time comum. Saldo de gols médio contra times da CPU.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { BaseCard, Position } from "@/lib/cards/generate";
import { hash32 } from "@/lib/cards/generate";
import { botTeam } from "@/lib/league/bots";
import { simulate } from "@/lib/sim/engine";
import { autoLineup, decodeLineup, encodeLineup, type Lineup } from "@/lib/tactics/lineup";

type Bias = Partial<Record<Position, Record<string, number>>>;
const tweak = (squad: BaseCard[], bias: Bias) =>
  squad.map((c) => {
    const b = bias[c.position];
    return b ? { ...c, stats: c.stats.map((s) => ({ ...s, value: Math.max(20, Math.min(95, s.value + (b[s.label] ?? 0))) })) } : c;
  });

const N = 900;
function gd(squad: BaseCard[], lu: Lineup, set: Partial<Lineup>, oppBias: Bias = {}) {
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const o = botTeam(4000 + i, i % 10, 1);
    const mine = { name: "A", short: "AAA", squad, lineup: { ...lu, ...set }, ai: false };
    const opp = { name: "B", short: "BBB", squad: tweak(o.squad, oppBias), lineup: o.lineup, ai: false };
    const home = i % 2 === 0;
    const r = simulate({ seed: i * 104729 + 7, home: home ? mine : opp, away: home ? opp : mine });
    sum += home ? r.score[0] - r.score[1] : r.score[1] - r.score[0];
  }
  return sum / N;
}

const base = botTeam(77, 3, 1);
const lu = autoLineup({ ...base.lineup, formation: 0, posture: 2, marking: 1, passing: 1 }, base.squad);
const sq = (b: Bias) => tweak(base.squad, b);
const best = (vals: number[]) => vals.indexOf(Math.max(...vals));

test("modo normal idêntico ao motor antigo (impressão digital de 300 jogos)", () => {
  let acc = "";
  for (let i = 0; i < 300; i++) {
    const a = botTeam(70 + i, i % 10, i % 6);
    const b = botTeam(900 + i, (i + 3) % 10, (i + 2) % 6);
    const r = simulate({
      seed: i * 7919 + 1,
      neutral: i % 5 === 0,
      home: { name: "A", short: "AAA", squad: a.squad, lineup: a.lineup, ai: true },
      away: { name: "B", short: "BBB", squad: b.squad, lineup: b.lineup, ai: i % 2 === 0 },
      changes: i % 3 === 0 ? [{ minute: 30, team: 0, kind: "tactic", posture: 4 }, { minute: 60, team: 1, kind: "sub", out: b.lineup.xi[5], in: 12 }] : [],
    });
    acc += JSON.stringify([r.score, r.events.map((e) => [e.tick, e.type, e.player, e.other, e.text]), r.ratings, r.stats, r.length]);
  }
  assert.equal(hash32(acc).toString(16), "cb7bdef");
});

test("código da escalação: ajustes novos só aparecem quando saem do normal", () => {
  assert.doesNotMatch(encodeLineup(lu), /:\d{3}$/);
  const code = encodeLineup({ ...lu, line: 2, width: 0, tempo: 2 });
  assert.match(code, /:202$/);
  const back = decodeLineup(code, base.squad.length)!;
  assert.deepEqual([back.line, back.width, back.tempo], [2, 0, 2]);
  assert.equal(decodeLineup(encodeLineup(lu), base.squad.length)!.line, undefined);
});

test("jogo: pontas para quem tem pontas, meio para quem tem meias", () => {
  const wingers = sq({ PD: { VEL: 14, DRI: 10, PAS: 6 }, PE: { VEL: 14, DRI: 10, PAS: 6 }, LD: { VEL: 12, PAS: 6 }, LE: { VEL: 12, PAS: 6 }, MEI: { PAS: -8, DRI: -8 }, ATA: { PAS: -6, DRI: -6 }, MC: { PAS: -6 } });
  const central = sq({ MEI: { PAS: 12, DRI: 10, FIN: 6 }, ATA: { PAS: 8, DRI: 10, FIN: 6 }, MC: { PAS: 10, DRI: 6 }, PD: { VEL: -12, DRI: -10 }, PE: { VEL: -12, DRI: -10 }, LD: { VEL: -10 }, LE: { VEL: -10 } });
  const w = [0, 1, 2].map((x) => gd(wingers, lu, { width: x }));
  const c = [0, 1, 2].map((x) => gd(central, lu, { width: x }));
  assert.equal(best(w), 2, `time de pontas: ${w.map((x) => x.toFixed(2))}`);
  assert.equal(best(c), 0, `time de meio: ${c.map((x) => x.toFixed(2))}`);
  assert.ok(w[2] - w[0] > 0.15 && c[0] - c[2] > 0.15);
});

test("linha: adiantada com zaga rápida, recuada com zaga lenta (contra atacantes rápidos)", () => {
  const fastOpp: Bias = { ATA: { VEL: 14 }, PD: { VEL: 14 }, PE: { VEL: 14 } };
  const fast = [0, 1, 2].map((x) => gd(sq({ ZAG: { VEL: 16 }, LD: { VEL: 12 }, LE: { VEL: 12 } }), lu, { line: x }, fastOpp));
  const slow = [0, 1, 2].map((x) => gd(sq({ ZAG: { VEL: -14 }, LD: { VEL: -12 }, LE: { VEL: -12 } }), lu, { line: x }, fastOpp));
  assert.equal(best(fast), 2, `zaga rápida: ${fast.map((x) => x.toFixed(2))}`);
  assert.equal(best(slow), 0, `zaga lenta: ${slow.map((x) => x.toFixed(2))}`);
  assert.ok(slow[0] > slow[2] + 0.08);
});

test("ritmo: acelerado para time atlético, cadenciado para meio-campo de passe", () => {
  const athletic = sq({ VOL: { VEL: 10, FÍS: 12 }, MC: { VEL: 10, FÍS: 12, PAS: -8 }, MEI: { VEL: 10, FÍS: 10, PAS: -8 }, PD: { VEL: 10, FÍS: 10 }, PE: { VEL: 10, FÍS: 10 }, ATA: { VEL: 10, FÍS: 10 }, LD: { FÍS: 10 }, LE: { FÍS: 10 } });
  const technical = sq({ VOL: { PAS: 12, DRI: 8, VEL: -8, FÍS: -8 }, MC: { PAS: 14, DRI: 10, VEL: -8, FÍS: -8 }, MEI: { PAS: 14, DRI: 10, VEL: -8 }, ATA: { VEL: -6, FÍS: -6 }, PD: { VEL: -6 }, PE: { VEL: -6 } });
  const a = [0, 1, 2].map((x) => gd(athletic, lu, { tempo: x }));
  const t = [0, 1, 2].map((x) => gd(technical, lu, { tempo: x }));
  assert.equal(best(a), 2, `atlético: ${a.map((x) => x.toFixed(2))}`);
  assert.equal(best(t), 0, `técnico: ${t.map((x) => x.toFixed(2))}`);
});

test("time comum: nenhuma opção domina", () => {
  for (const key of ["width", "line", "tempo"] as const) {
    const vals = [0, 1, 2].map((x) => gd(base.squad, lu, { [key]: x }));
    const spread = Math.max(...vals) - vals[1];
    assert.ok(spread < 0.12, `${key}: ${vals.map((x) => x.toFixed(2))}`);
  }
});
