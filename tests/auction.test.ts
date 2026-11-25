import assert from "node:assert/strict";
import { test } from "node:test";
import { lotCard, lotTier, MIN_BID, nextMinBid, roundAt, roundEnd, roundStart, wonAt, type WonLot } from "@/lib/auction/lots";
import { evolveCard } from "@/lib/cards/evolution";
import { clubCards } from "@/lib/cards/squad";
import { CARD_TIERS } from "@/lib/game-config";
import { buildLeagueData, matchAt, type LeagueClub, type LeagueRow } from "@/lib/league/core";
import { encodeLineup, autoLineup, defaultLineup } from "@/lib/tactics/lineup";

test("rodadas de 2 horas e raridade dos lotes", () => {
  const t = Date.UTC(2026, 10, 25, 13, 30);
  const r = roundAt(t);
  assert.ok(roundStart(r) <= t && t < roundEnd(r));
  assert.equal(roundEnd(r) - roundStart(r), 7200_000);
  const tiers = (round: number) => Array.from({ length: 8 }, (_, i) => lotTier(round, i));
  assert.deepEqual(tiers(4), ["destaque", "destaque", "destaque", "destaque", "destaque", "epica", "epica", "especial"]);
  assert.deepEqual(tiers(5), ["destaque", "destaque", "destaque", "destaque", "destaque", "epica", "epica", "destaque"]);
});

test("lance mínimo: piso da raridade, depois +5% (no mínimo +10)", () => {
  assert.equal(nextMinBid("destaque", null), MIN_BID.destaque);
  assert.equal(nextMinBid("destaque", 300), 315);
  assert.equal(nextMinBid("destaque", 100), 110);
  assert.equal(nextMinBid("especial", 2500), 2625);
});

test("carta do lote: determinística e na faixa da raridade", () => {
  for (let r = 1000; r < 1040; r++) {
    for (let i = 0; i < 8; i++) {
      const a = lotCard(r, i);
      assert.deepEqual(a, lotCard(r, i));
      const tier = lotTier(r, i);
      assert.equal(a.tier, tier);
      const [lo, hi] = CARD_TIERS[tier].startOverall;
      assert.ok(a.overall >= lo && a.overall <= hi, `${tier} ${a.overall}`);
    }
  }
  const d = { ...lotCard(1000, 0), overall: 77 };
  assert.equal(evolveCard(d, 99999).overall, CARD_TIERS.destaque.maxOverall);
  assert.equal(evolveCard(d, 99999).level, CARD_TIERS.destaque.maxLevel);
});

test("cartas arrematadas entram no fim do elenco, em ordem estável", () => {
  const id = "c0ffee00-0000-4000-8000-0000000000aa";
  const won: WonLot[] = [
    { round: 50, idx: 3, ends_at: "2026-01-02T10:00:00Z" },
    { round: 40, idx: 1, ends_at: "2026-01-01T10:00:00Z" },
  ];
  const all = clubCards(id, "1:21021021021012", null, won);
  assert.equal(all.length, 16);
  assert.equal(all[14].key, "L40-1");
  assert.equal(all[15].key, "L50-3");
  const before = clubCards(id, "1:21021021021012", null, won, Date.parse("2026-01-01T12:00:00Z"));
  assert.equal(before.length, 15);
  assert.equal(wonAt(won, Date.parse("2025-12-31T00:00:00Z")).length, 0);
});

test("carta arrematada depois do apito não muda o jogo (nem os já jogados)", () => {
  const start = Date.UTC(2026, 0, 1, 11);
  const league: LeagueRow = { id: 777, division: 0, size: 10, rounds: 18, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 40 * 3600_000).toISOString(), closed_at: null, final: null };
  const rounds = Array.from({ length: 18 }, (_, i) => ({ round: i + 1, kickoff: new Date(start + i * 7200_000).toISOString() }));
  const base: LeagueClub = { id: "c0ffee00-0000-4000-8000-0000000000bb", name: "Teste", tag: "TST", crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21021021021012", league_slot: 0, joined_round: 1, xp: null };
  // a carta foi arrematada entre a rodada 3 e a 4
  const lot = { round: 9, idx: 7, ends_at: new Date(start + 2.5 * 7200_000).toISOString(), best_club: base.id };
  const plain = buildLeagueData({ league, rounds, clubs: [base], logs: [], changes: [] });
  const withLot = buildLeagueData({ league, rounds, clubs: [base], logs: [], changes: [], lots: [lot] });
  const idx = (d: typeof plain, r: number) => d.fixtures[r - 1].findIndex((f) => f.home === 0 || f.away === 0);
  for (const r of [1, 2, 3]) assert.deepEqual(matchAt(withLot, r, idx(withLot, r)).result, matchAt(plain, r, idx(plain, r)).result, `rodada ${r}`);
  const m4 = matchAt(withLot, 4, idx(withLot, 4));
  const mine = m4.home.clubId === base.id ? m4.home : m4.away;
  assert.equal(mine.squad.length, 15);
  // escalação que usa a carta nova (índice 14 = "e") só vale depois de arrematar
  const squad15 = clubCards(base.id, base.squad, null, [lot]);
  const lu = autoLineup(defaultLineup(squad15), squad15);
  assert.match(encodeLineup(lu), /^1:[0-9a-d]:[0-9a-n]{11}:/);
});
