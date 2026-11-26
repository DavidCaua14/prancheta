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

test("CPU fica mais forte a cada divisão (Várzea < D < C < B < A < Lendas)", () => {
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
  const c = avg(2);
  const b = avg(3);
  const a = avg(4);
  const l = avg(5);
  assert.ok(d - v >= 2 && d - v <= 5, `várzea ${v.toFixed(1)} × série D ${d.toFixed(1)}`);
  assert.ok(c - d >= 1.5 && c - d <= 4, `série D ${d.toFixed(1)} × série C ${c.toFixed(1)}`);
  assert.ok(b - c >= 1.5 && b - c <= 4, `série C ${c.toFixed(1)} × série B ${b.toFixed(1)}`);
  assert.ok(a - b >= 1.5 && a - b <= 4, `série B ${b.toFixed(1)} × série A ${a.toFixed(1)}`);
  assert.notEqual(botTeam(3, 0, 3).name, botTeam(3, 0, 2).name);
  assert.ok(l - a >= 1.5 && l - a <= 4, `série A ${a.toFixed(1)} × lendas ${l.toFixed(1)}`);
  assert.notEqual(botTeam(3, 0, 4).name, botTeam(3, 0, 3).name);
  assert.notEqual(botTeam(3, 0, 5).name, botTeam(3, 0, 4).name);
  assert.notEqual(botTeam(3, 0, 1).name, botTeam(3, 0, 0).name);
  assert.notEqual(botTeam(3, 0, 2).name, botTeam(3, 0, 1).name);
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
  assert.deepEqual([1, 4, 5, 7, 8, 10].map((p) => zoneOf(d, p, 10)), ["up", "up", null, null, "down", "down"]);
  const c = divisionInfo(2);
  assert.deepEqual([1, 4, 5, 7, 8, 10].map((p) => zoneOf(c, p, 10)), ["up", "up", null, null, "down", "down"]);
  const b = divisionInfo(3);
  assert.deepEqual([1, 4, 5, 7, 8, 10].map((p) => zoneOf(b, p, 10)), ["up", "up", null, null, "down", "down"]);
  const a = divisionInfo(4);
  assert.deepEqual([1, 4, 5, 7, 8, 10].map((p) => zoneOf(a, p, 10)), ["up", "up", null, null, "down", "down"]);
  const l = divisionInfo(5);
  assert.deepEqual([1, 7, 8, 10].map((p) => zoneOf(l, p, 10)), [null, null, "down", "down"]);
  assert.equal(a.upTo, l.name);
  assert.equal(l.downTo, a.name);
  assert.equal(divisionInfo(6), divisionInfo(0)); // fora da pirâmide cai no padrão
  assert.equal(b.upTo, a.name);
  assert.equal(a.downTo, b.name);
  assert.equal(c.upTo, b.name);
  assert.equal(b.downTo, c.name);
  assert.equal(d.upTo, c.name);
  assert.equal(c.downTo, d.name);
});

test("escalação salva há muito tempo (antes da janela antiga de 11 dias) vale no jogo", async () => {
  const { matchAt, logsFrom } = await import("@/lib/league/core");
  const lg = league(91, 0);
  const start = new Date(lg.starts_at).getTime();
  const rounds = Array.from({ length: 18 }, (_, i) => ({ round: i + 1, kickoff: new Date(start + i * 7200_000).toISOString() }));
  const club = { id: "11111111-1111-4111-8111-111111111111", name: "Tubarões da Vila", tag: "TUV", crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21201201201123", league_slot: 0, joined_round: 1, xp: null };
  // a janela começa no início da liga: a RPC lineup_log_window devolve a última linha até lá, mesmo com 20 dias
  assert.equal(logsFrom(lg), lg.starts_at);
  const old = { club_id: club.id, at: new Date(start - 20 * 86400_000).toISOString(), lineup: "1:9:01234567a98:211:5a" };
  const withLog = buildLeagueData({ league: lg, rounds, clubs: [club], logs: [old], changes: [] });
  const without = buildLeagueData({ league: lg, rounds, clubs: [club], logs: [], changes: [] });
  const mine = (d: typeof withLog) => {
    for (let i = 0; i < 5; i++) {
      const x = matchAt(d, 1, i);
      if (x.home.clubId === club.id) return x.homeLineup;
      if (x.away.clubId === club.id) return x.awayLineup;
    }
    throw new Error("clube sem jogo na rodada 1");
  };
  assert.equal(mine(withLog).formation, 9);
  assert.notEqual(mine(without).formation, 9);
});
