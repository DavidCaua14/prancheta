import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCupData, cupStats, pathOf, type CupRow } from "@/lib/cup/core";
import { COIN_PACKS, seasonPrize, START_COINS } from "@/lib/economy";
import { buildLeagueData, clubLeagueStats, finalTable, type LeagueClub, type LeagueRow } from "@/lib/league/core";
import { MIN_BID } from "@/lib/auction/lots";

test("prêmios de temporada (mesmos valores do SQL season_prize)", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((d) => seasonPrize(d, 1)), [450, 525, 600, 750, 900, 1050]);
  assert.equal(seasonPrize(0, 10), 75);
  // sempre cai com a posição e sobe com a divisão
  for (let d = 0; d <= 5; d++) for (let p = 1; p < 10; p++) assert.ok(seasonPrize(d, p) > seasonPrize(d, p + 1));
  for (let d = 0; d < 5; d++) assert.ok(seasonPrize(d + 1, 1) > seasonPrize(d, 1));
  // prêmio compra cartas Base boas, nunca uma rara sozinho
  for (let d = 0; d <= 5; d++) {
    assert.ok(seasonPrize(d, 1) >= 3 * MIN_BID.base, `div ${d}`);
    assert.ok(seasonPrize(d, 1) < MIN_BID.destaque, `div ${d}`);
  }
  assert.ok(START_COINS >= 3 * MIN_BID.base && START_COINS < MIN_BID.destaque);
  // rara exige paciência (semanas de eventos ~1.500) ou pacote
  const weeklyFree = 3 * seasonPrize(0, 5) + 7 * 30 + 1500;
  assert.ok(weeklyFree < MIN_BID.destaque * 2, `grátis por semana ~${weeklyFree}`);
  assert.ok(MIN_BID.especial / weeklyFree > 4, "Especial leva semanas sem pacote");
  // pacotes: acesso rápido a muitas moedas
  const bau = COIN_PACKS.find((p) => p.id === "bau")!;
  assert.ok(bau.coins >= MIN_BID.especial);
  assert.ok(COIN_PACKS.find((p) => p.id === "punhado")!.coins >= weeklyFree);
});

test("pacotes: quanto maior, mais moedas por real", () => {
  const regular = COIN_PACKS.filter((p) => !p.once).sort((a, b) => a.price - b.price);
  for (let i = 1; i < regular.length; i++) assert.ok(regular[i].coins / regular[i].price > regular[i - 1].coins / regular[i - 1].price, regular[i].id);
  const estreia = COIN_PACKS.find((p) => p.once)!;
  assert.ok(estreia.coins / estreia.price > regular[0].coins / regular[0].price);
  for (const p of COIN_PACKS) assert.ok(p.price < 100 && p.coins > 0 && p.bonus < p.coins);
});

test("estatísticas da temporada batem com a tabela", () => {
  const start = Date.UTC(2026, 0, 1, 11);
  const league: LeagueRow = { id: 812, division: 0, size: 10, rounds: 18, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 40 * 3600_000).toISOString(), closed_at: null, final: null };
  const rounds = Array.from({ length: 18 }, (_, i) => ({ round: i + 1, kickoff: new Date(start + i * 7200_000).toISOString() }));
  const club: LeagueClub = { id: "c0ffee00-0000-4000-8000-0000000000ee", name: "Teste", tag: "TST", crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21021021021012", league_slot: 6, joined_round: 1, xp: null };
  const data = buildLeagueData({ league, rounds, clubs: [club], logs: [], changes: [] });
  const s = clubLeagueStats(data, club.id, Number.POSITIVE_INFINITY);
  const row = finalTable(data).find((r) => r.slot === 6)!;
  assert.deepEqual([s.games, s.wins, s.draws, s.goals_for, s.goals_against], [row.j, row.v, row.e, row.gp, row.gc]);
  assert.ok(s.clean_sheets <= s.games && s.big_wins <= s.wins);
  // no meio da temporada só contam os jogos terminados
  assert.equal(clubLeagueStats(data, club.id, start + 3 * 7200_000 + 60_000).games, 3);
});

test("estatísticas da copa: jogos até cair, fases avançadas", () => {
  const start = Date.UTC(2026, 0, 1, 16);
  const cup: CupRow = { id: 77, kind: 0, size: 32, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 8.25 * 3600_000).toISOString(), closed_at: null, champion: null };
  const d = buildCupData({ cup, entries: [], logs: [], changes: [] });
  for (let slot = 0; slot < 32; slot++) {
    const s = cupStats(d, slot);
    assert.equal(s.games, pathOf(d, slot).length);
    assert.ok(s.cup_wins === s.games || s.cup_wins === s.games - 1);
  }
});
