import assert from "node:assert/strict";
import { test } from "node:test";
import { evolveCard, levelFromXp, matchXp, seasonBonus, xpToMax, XP_RULES } from "@/lib/cards/evolution";
import { clubCards, draftOption } from "@/lib/cards/squad";
import { botTeam } from "@/lib/league/bots";
import { buildLeagueData, clubMatchXp, type LeagueClub, type LeagueRow } from "@/lib/league/core";
import { simulate } from "@/lib/sim/engine";
import { defaultLineup } from "@/lib/tactics/lineup";

test("curva de níveis", () => {
  assert.deepEqual(levelFromXp(0, 10), { level: 1, into: 0, need: 50, max: false });
  assert.equal(levelFromXp(49, 10).level, 1);
  assert.equal(levelFromXp(50, 10).level, 2);
  assert.equal(levelFromXp(125, 10).level, 3);
  assert.equal(xpToMax(10), 1350);
  assert.equal(levelFromXp(1350, 10).level, 10);
  assert.equal(levelFromXp(99999, 10).max, true);
});

test("nível soma overall e atributos, até o teto da carta Base (70)", () => {
  const c = draftOption("clube-teste", 0, 0);
  assert.equal(evolveCard(c, 0), c);
  const lv5 = evolveCard(c, 50 + 75 + 100 + 125);
  assert.equal(lv5.level, 5);
  assert.equal(lv5.overall, Math.min(70, c.overall + 4));
  assert.equal(lv5.stats[0].value, c.stats[0].value + (lv5.overall - c.overall));
  const max = evolveCard({ ...c, overall: 66 }, 5000);
  assert.equal(max.level, 10);
  assert.equal(max.overall, 70);
});

test("XP por jogo: quem joga ganha mais que o banco; gol e assistência contam", () => {
  const a = botTeam(9, 0, 0);
  const b = botTeam(9, 1, 0);
  let starters = 0;
  let bench = 0;
  let n = 0;
  for (let i = 0; i < 200; i++) {
    const r = simulate({ seed: i, home: { name: "A", short: "AAA", squad: a.squad, lineup: a.lineup, ai: true }, away: { name: "B", short: "BBB", squad: b.squad, lineup: b.lineup, ai: true } });
    const xp = matchXp(r, 0, a.lineup.xi, 14);
    const goals = r.events.filter((e) => e.team === 0 && (e.type === "goal" || e.type === "penalty_goal")).length;
    const sum = xp.reduce((s, v) => s + v, 0);
    assert.ok(sum >= 11 * XP_RULES.starter + goals * XP_RULES.goal);
    a.lineup.xi.forEach((k) => (starters += xp[k]));
    xp.forEach((v, k) => {
      if (!a.lineup.xi.includes(k) && r.ratings[0][k] === undefined) {
        assert.equal(v, XP_RULES.bench);
        bench += v;
      }
    });
    n++;
  }
  const perStarter = starters / n / 11;
  assert.ok(perStarter > 7 && perStarter < 14, `titular ganha ${perStarter.toFixed(1)} XP/jogo`);
  assert.ok(bench > 0);
  assert.equal(seasonBonus(1, 1), 100);
  assert.equal(seasonBonus(5, 0), 0);
});

test("XP da temporada: 18 jogos do técnico e ritmo de evolução", () => {
  const start = Date.UTC(2026, 0, 1, 11);
  const league: LeagueRow = { id: 501, division: 0, size: 10, rounds: 18, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 40 * 3600_000).toISOString(), closed_at: null, final: null };
  const rounds = Array.from({ length: 18 }, (_, i) => ({ round: i + 1, kickoff: new Date(start + i * 7200_000).toISOString() }));
  const club: LeagueClub = { id: "c0ffee00-0000-4000-8000-000000000001", name: "Teste", tag: "TST", crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21021021021012", league_slot: 3, joined_round: 1, xp: null };
  const data = buildLeagueData({ league, rounds, clubs: [club], logs: [], changes: [] });
  const { xp, games } = clubMatchXp(data, club.id, Number.POSITIVE_INFINITY);
  assert.equal(games, 18);
  const squad = clubCards(club.id, club.squad, null);
  const xi = defaultLineup(squad).xi;
  const avgStarter = xi.reduce((s, k) => s + xp[k], 0) / xi.length;
  const seasons = 1350 / avgStarter;
  assert.ok(seasons >= 5 && seasons <= 10, `titular chega ao nível 10 em ${seasons.toFixed(1)} temporadas (${avgStarter.toFixed(0)} XP/temporada)`);
  // a 1ª temporada já rende ao menos 2 níveis para um titular
  assert.ok(levelFromXp(avgStarter, 10).level >= 3);
  // ninguém passa do teto que o banco aceita
  assert.ok(xp.every((v) => v >= 0 && v <= 3000));
});

test("clube com XP fica mais forte nos jogos da liga", () => {
  const id = "c0ffee00-0000-4000-8000-000000000002";
  const squad = "1:21021021021012";
  const base = clubCards(id, squad, null);
  const maxed = clubCards(id, squad, Array(14).fill(1350));
  assert.ok(maxed.every((c, i) => c.level === 10 && c.overall >= base[i].overall));
  assert.ok(maxed.reduce((s, c) => s + c.overall, 0) > base.reduce((s, c) => s + c.overall, 0) + 14 * 6);
});
