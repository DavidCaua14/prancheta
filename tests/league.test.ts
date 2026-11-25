import assert from "node:assert/strict";
import { test } from "node:test";
import { botTeam } from "@/lib/league/bots";
import { buildLeagueData, finalCode, finalTable, type LeagueRow } from "@/lib/league/core";
import { divisionInfo, zoneOf } from "@/lib/league/divisions";
import { FORMATIONS, strength } from "@/lib/tactics/formations";

function league(id: number, division: number): LeagueRow {
  const start = Date.UTC(2026, 0, 1, 11);
  return { id, division, size: 10, rounds: 18, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 40 * 3600_000).toISOString(), closed_at: null, final: null };
}
function data(id: number, division = 0) {
  const lg = league(id, division);
  const start = new Date(lg.starts_at).getTime();
  const rounds = Array.from({ length: 18 }, (_, i) => ({ round: i + 1, kickoff: new Date(start + i * 7200_000).toISOString() }));
  return buildLeagueData({ league: lg, rounds, clubs: [], logs: [], changes: [] });
}

test("times da CPU da Várzea não mudam (ligas antigas são recalculadas)", () => {
  const b = botTeam(3, 0, 0);
  assert.equal(b.name, "Terrão FC");
  assert.equal(b.squad.map((c) => c.overall).join(","), "53,53,53,47,52,56,53,58,53,53,47,53,53,56");
});

test("CPU da Série D é mais forte que a da Várzea", () => {
  const avg = (div: number) => {
    let t = 0;
    for (let L = 1; L <= 40; L++)
      for (let s = 0; s < 10; s++) {
        const b = botTeam(L, s, div);
        t += strength(FORMATIONS[b.lineup.formation], b.lineup.xi.map((i) => b.squad[i])).ovr;
      }
    return t / 400;
  };
  const v = avg(0);
  const d = avg(1);
  assert.ok(d - v >= 2 && d - v <= 5, `várzea ${v.toFixed(1)} × série D ${d.toFixed(1)}`);
  assert.notEqual(botTeam(3, 0, 1).name, botTeam(3, 0, 0).name);
});

test("tabela final: ordem é uma permutação das vagas e é determinística", () => {
  const a = finalTable(data(77));
  const b = finalTable(data(77));
  const code = finalCode(a);
  assert.match(code, /^[0-9]{10}$/);
  assert.equal([...code].sort().join(""), "0123456789");
  assert.equal(code, finalCode(b));
  assert.ok(a.every((r) => r.j === 18));
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].p >= a[i].p);
});

test("zonas de acesso e rebaixamento", () => {
  const v = divisionInfo(0);
  const d = divisionInfo(1);
  assert.deepEqual([1, 4, 5, 10].map((p) => zoneOf(v, p, 10)), ["up", "up", null, null]);
  assert.deepEqual([1, 7, 8, 10].map((p) => zoneOf(d, p, 10)), [null, null, "down", "down"]);
});
