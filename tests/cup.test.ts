import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCupData, CUP_KINDS, cupMatch, cupReach, pathOf, roundName, slotsIn, type CupEntry, type CupRow } from "@/lib/cup/core";
import { shootout } from "@/lib/cup/shootout";
import { botTeam } from "@/lib/league/bots";
import { simulate } from "@/lib/sim/engine";

function cup(id: number, entries: CupEntry[] = []) {
  const start = Date.UTC(2026, 0, 1, 16);
  const row: CupRow = { id, kind: 0, size: 32, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 8.25 * 3600_000).toISOString(), closed_at: null, champion: null };
  return buildCupData({ cup: row, entries, logs: [], changes: [] });
}

test("chaveamento: 5 fases, metade avança em cada uma, um campeão", () => {
  const d = cup(11);
  assert.deepEqual([1, 2, 3, 4, 5].map((r) => slotsIn(d, r).length), [32, 16, 8, 4, 2]);
  assert.equal(d.kickoffs[4] - d.kickoffs[0], 8 * 3600_000);
  const reach = cupReach(d);
  // mesma regra que close_cup() confere no banco
  const count = (r: number) => reach.filter((x) => x === r).length;
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(count), [16, 8, 4, 2, 1, 1]);
  // o campeão venceu a final
  const final = cupMatch(d, 5, 0);
  assert.equal(reach.indexOf(5), final.winner === 0 ? final.home.slot : final.away.slot);
  assert.deepEqual(["Final", "Semifinal", "Quartas", "Oitavas", "1ª fase"], [5, 4, 3, 2, 1].map((r) => roundName(r, 5)));
});

test("copa determinística: mesmos dados, mesmo campeão; empate vai para os pênaltis", () => {
  let pens = 0;
  for (let id = 100; id < 110; id++) {
    assert.deepEqual(cupReach(cup(id)), cupReach(cup(id)));
    for (let r = 1; r <= 5; r++) {
      for (let i = 0; i < slotsIn(cup(id), r).length / 2; i++) {
        const m = cupMatch(cup(id), r, i);
        const [h, a] = m.result.score;
        if (h === a) {
          pens++;
          assert.ok(m.shootout);
          assert.notEqual(m.shootout.score[0], m.shootout.score[1]);
          assert.equal(m.winner, m.shootout.winner);
        } else {
          assert.equal(m.shootout, null);
          assert.equal(m.winner, h > a ? 0 : 1);
        }
      }
    }
  }
  assert.ok(pens > 10, `${pens} disputas de pênaltis em 310 jogos`);
});

test("pênaltis: cinco cobranças, morte súbita e conversão realista", () => {
  const a = botTeam(5, 0, 0);
  const b = botTeam(5, 1, 0);
  let goals = 0;
  let kicks = 0;
  for (let s = 0; s < 300; s++) {
    const so = shootout(s, [a, b], []);
    assert.ok(so.kicks.length >= 6);
    const [h, w] = so.score;
    assert.notEqual(h, w);
    goals += so.kicks.filter((k) => k.scored).length;
    kicks += so.kicks.length;
    // ninguém cobra 2 vezes antes de todos os 10 de linha cobrarem
    const first = so.kicks.filter((k) => k.side === 0).slice(0, 10).map((k) => k.player);
    assert.equal(new Set(first).size, first.length);
  }
  const rate = goals / kicks;
  assert.ok(rate > 0.65 && rate < 0.85, `conversão ${(rate * 100).toFixed(0)}%`);
  // a disputa não muda o placar do jogo
  const r = simulate({ seed: 7, neutral: true, home: { name: "A", short: "AAA", squad: a.squad, lineup: a.lineup, ai: true }, away: { name: "B", short: "BBB", squad: b.squad, lineup: b.lineup, ai: true } });
  assert.deepEqual(r.score, simulate({ seed: 7, neutral: true, home: { name: "A", short: "AAA", squad: a.squad, lineup: a.lineup, ai: true }, away: { name: "B", short: "BBB", squad: b.squad, lineup: b.lineup, ai: true } }).score);
});

test("clube inscrito joga com a força congelada na inscrição", () => {
  const club = { name: "Teste", tag: "TST", crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21021021021012" };
  const id = "c0ffee00-0000-4000-8000-0000000000dd";
  const base = cup(300, [{ slot: 7, club_id: id, xp: null, reach: null, coins: null, clubs: club }]);
  const maxed = cup(300, [{ slot: 7, club_id: id, xp: Array(14).fill(1350), reach: null, coins: null, clubs: club }]);
  const p1 = pathOf(base, 7);
  const p2 = pathOf(maxed, 7);
  assert.equal(p1[0].home.slot === 7 ? p1[0].home.name : p1[0].away.name, "Teste");
  const ovr = (m: ReturnType<typeof cupMatch>) => (m.home.slot === 7 ? m.home : m.away).squad.reduce((s, c) => s + c.overall, 0);
  assert.ok(ovr(p2[0]) > ovr(p1[0]));
  // campeões: o clube evoluído vai mais longe na média de várias edições
  let far = [0, 0];
  for (let k = 0; k < 30; k++) {
    const e = (xp: number[] | null) => cup(400 + k, [{ slot: 7, club_id: id, xp, reach: null, coins: null, clubs: club }]);
    far = [far[0] + cupReach(e(null))[7], far[1] + cupReach(e(Array(14).fill(1350)))[7]];
  }
  assert.ok(far[1] > far[0], `base ${far[0] / 30} fases × evoluído ${far[1] / 30}`);
  assert.equal(CUP_KINDS[0].prizes[5], 600);
});
