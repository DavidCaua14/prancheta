import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCupData, CUP_KINDS, cupMatch, cupReach, cupTeam, pathOf, roundName, slotsIn, type CupEntry, type CupRow } from "@/lib/cup/core";
import { nextEditionStart } from "@/lib/cup/data";
import { FORMATIONS, strength } from "@/lib/tactics/formations";
import { shootout } from "@/lib/cup/shootout";
import { botTeam } from "@/lib/league/bots";
import { simulate } from "@/lib/sim/engine";

function cup(id: number, entries: CupEntry[] = [], kind = 0) {
  const start = Date.UTC(2026, 0, 1, 16);
  const size = CUP_KINDS[kind].size;
  const row: CupRow = { id, kind, size, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 8.25 * 3600_000).toISOString(), closed_at: null, champion: null };
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
  assert.equal(CUP_KINDS[0].prizes[5], 300);
});

test("Copa Nacional: 64 clubes, 6 fases, CPU da Série C e nomes sem repetir", () => {
  const d = cup(21, [], 1);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((r) => slotsIn(d, r).length), [64, 32, 16, 8, 4, 2]);
  const reach = cupReach(d);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((r) => reach.filter((x) => x === r).length), [32, 16, 8, 4, 2, 1, 1]);
  assert.deepEqual([1, 2, 3, 6].map((r) => roundName(r, 6)), ["1ª fase", "2ª fase", "Oitavas", "Final"]);
  const names = Array.from({ length: 64 }, (_, s) => cupTeam(d, s, d.kickoffs[0]).name);
  assert.equal(new Set(names).size, 64);
  const v = cup(22, [], 0);
  assert.equal(new Set(Array.from({ length: 32 }, (_, s) => cupTeam(v, s, v.kickoffs[0]).name)).size, 32);
  // CPU da Nacional (Série C) é mais forte que a da Copa da Várzea
  const avg = (dd: typeof d, n: number) =>
    Array.from({ length: n }, (_, s) => {
      const t = cupTeam(dd, s, dd.kickoffs[0]);
      const m = cupMatch(dd, 1, Math.floor(s / 2));
      const lu = m.home.slot === s ? m.homeLineup : m.awayLineup;
      return strength(FORMATIONS[lu.formation], lu.xi.map((i) => t.squad[i])).ovr;
    }).reduce((a, b) => a + b, 0) / n;
  assert.ok(avg(d, 64) > avg(v, 32) + 3);
  assert.equal(CUP_KINDS[1].prizes.length, 7);
  assert.equal(CUP_KINDS[1].prizes[6], 500);
});

test("próxima edição: hoje antes do prazo, amanhã depois", () => {
  const brt = (h: number, m: number) => Date.UTC(2026, 5, 10, h + 3, m); // Brasília = UTC-3
  assert.equal(nextEditionStart(brt(9, 0), CUP_KINDS[1]), brt(11, 30));
  assert.equal(nextEditionStart(brt(11, 20), CUP_KINDS[1]), brt(11, 30) + 86400_000);
  assert.equal(nextEditionStart(brt(12, 44), CUP_KINDS[0]), brt(13, 0));
  assert.equal(nextEditionStart(brt(12, 45), CUP_KINDS[0]), brt(13, 0) + 86400_000);
});

test("Supercopa: 16 campeões, 4 fases, todo domingo", () => {
  const d = cup(31, [], 2);
  assert.deepEqual([1, 2, 3, 4].map((r) => slotsIn(d, r).length), [16, 8, 4, 2]);
  assert.deepEqual([1, 2, 3, 4].map((r) => roundName(r, 4)), ["Oitavas", "Quartas", "Semifinal", "Final"]);
  const reach = cupReach(d);
  assert.deepEqual([0, 1, 2, 3, 4].map((r) => reach.filter((x) => x === r).length), [8, 4, 2, 1, 1]);
  assert.equal(new Set(Array.from({ length: 16 }, (_, s) => cupTeam(d, s, d.kickoffs[0]).name)).size, 16);
  assert.deepEqual(CUP_KINDS[2].prizes, [100, 150, 250, 400, 800]);
  // 2026-06-10 é quarta-feira; domingos: 14/06 e 21/06
  const brt = (day: number, h: number, m: number) => Date.UTC(2026, 5, day, h + 3, m);
  assert.equal(nextEditionStart(brt(10, 9, 0), CUP_KINDS[2]), brt(14, 14, 30));
  assert.equal(nextEditionStart(brt(14, 14, 0), CUP_KINDS[2]), brt(14, 14, 30));
  assert.equal(nextEditionStart(brt(14, 14, 15), CUP_KINDS[2]), brt(21, 14, 30));
  assert.equal(nextEditionStart(brt(13, 23, 0), CUP_KINDS[2]), brt(14, 14, 30));
});
