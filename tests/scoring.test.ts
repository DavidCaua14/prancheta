import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCupData, cupMatch, slotsIn, type CupEntry, type CupRow } from "@/lib/cup/core";
import { buildLeagueData, clubLeagueStats, type LeagueClub, type LeagueRow } from "@/lib/league/core";
import { cupRoundPoints, leagueRoundPoints } from "@/lib/scoring";

const A = "c0ffee00-0000-4000-8000-0000000000a1";
const B = "c0ffee00-0000-4000-8000-0000000000b2";

function league() {
  const start = Date.UTC(2026, 0, 1, 11);
  const row: LeagueRow = { id: 801, division: 2, size: 10, rounds: 18, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 40 * 3600_000).toISOString(), closed_at: null, final: null };
  const rounds = Array.from({ length: 18 }, (_, i) => ({ round: i + 1, kickoff: new Date(start + i * 7200_000).toISOString() }));
  const club = (id: string, slot: number, joined = 1): LeagueClub => ({ id, name: `Clube ${slot}`, tag: `C0${slot}`, crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21021021021012", league_slot: slot, joined_round: joined, xp: null });
  return buildLeagueData({ league: row, rounds, clubs: [club(A, 0), club(B, 5, 4)], logs: [], changes: [] });
}

test("ranking jogo a jogo (liga): bate com a tabela e só técnicos reais pontuam", () => {
  const d = league();
  let wins = 0, draws = 0, big = 0, games = 0;
  for (let r = 1; r <= 18; r++) {
    const rows = leagueRoundPoints(d, r);
    // CPU não entra; quem entrou na rodada 4 só pontua dali em diante
    assert.ok(rows.every((x) => x.club_id === A || x.club_id === B));
    assert.equal(rows.some((x) => x.club_id === B), r >= 4);
    for (const x of rows.filter((x) => x.club_id === A)) {
      games++;
      if (x.result === 2) wins++;
      if (x.result === 1) draws++;
      if (x.big_win) big++;
      assert.equal(x.result, x.gf > x.ga ? 2 : x.gf === x.ga ? 1 : 0);
      assert.equal(x.big_win, x.gf - x.ga >= 3);
    }
  }
  // mesmos números que o fechamento grava em club_seasons
  const st = clubLeagueStats(d, A, Number.POSITIVE_INFINITY);
  assert.deepEqual([games, wins, draws, big], [st.games, st.wins, st.draws, st.big_wins]);
});

test("ranking jogo a jogo (copa): quem passa de fase, inclusive nos pênaltis", () => {
  const start = Date.UTC(2026, 0, 1, 16);
  const cup: CupRow = { id: 902, kind: 1, size: 64, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 10.25 * 3600_000).toISOString(), closed_at: null, champion: null };
  const e = (slot: number, id: string): CupEntry => ({ slot, club_id: id, xp: null, reach: null, coins: null, clubs: { name: `C${slot}`, tag: `C${String(slot).padStart(2, "0")}`, crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21021021021012" } });
  const d = buildCupData({ cup, entries: [e(0, A), e(1, B)], logs: [], changes: [] });
  // 1ª fase: os dois se enfrentam (vagas 0 × 1): um passa, o outro não
  const r1 = cupRoundPoints(d, 1);
  assert.equal(r1.length, 2);
  assert.equal(r1.filter((x) => x.advanced).length, 1);
  const m = cupMatch(d, 1, 0);
  assert.equal(r1.find((x) => x.club_id === A)!.advanced, m.winner === 0);
  // fase seguinte: só quem passou aparece
  const winner = r1.find((x) => x.advanced)!.club_id;
  const r2 = cupRoundPoints(d, 2);
  assert.deepEqual(r2.map((x) => x.club_id), [winner]);
  assert.equal(slotsIn(d, 2).length, 32);
  assert.deepEqual(cupRoundPoints(d, 99), []);
});
