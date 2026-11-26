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

test("pontos do jogo no ranking (espelho do SQL)", async () => {
  const { matchRankPoints } = await import("@/lib/ranking");
  // conferido no banco: liga Várzea, 6V 2E 2 goleadas = 76
  const v = (big = false) => matchRankPoints({ kind: 0, tier: 0, result: 2, gf: 3, ga: 0, big_win: big, advanced: false }).total;
  const e = matchRankPoints({ kind: 0, tier: 0, result: 1, gf: 1, ga: 1, big_win: false, advanced: false }).total;
  assert.equal(4 * v() + 2 * v(true) + 2 * e, 76);
  // Série B ×2; Copa das Lendas ×3; derrota e eliminação = 0
  assert.equal(matchRankPoints({ kind: 0, tier: 3, result: 2, gf: 4, ga: 0, big_win: true, advanced: false }).total, 30);
  assert.equal(matchRankPoints({ kind: 1, tier: 3, result: 1, gf: 1, ga: 1, big_win: false, advanced: true }).total, 45);
  assert.equal(matchRankPoints({ kind: 0, tier: 5, result: 0, gf: 0, ga: 2, big_win: false, advanced: false }).total, 0);
  assert.equal(matchRankPoints({ kind: 1, tier: 1, result: 2, gf: 2, ga: 1, big_win: false, advanced: false }).total, 0);
  assert.equal(matchRankPoints({ kind: 0, tier: 1, result: 2, gf: 2, ga: 1, big_win: false, advanced: false }).total, 13); // 10 × 1,25 = 12,5 → 13 (como o round do SQL)
});

test("eventos: 'a confirmar' somado jogo a jogo = cálculo antigo (liga + copa)", async () => {
  const { cupStats } = await import("@/lib/cup/core");
  // mesma soma do my_pending_stats() (SQL)
  const agg = (rows: { result: number; gf: number; ga: number; big_win: boolean; advanced: boolean; cup: boolean }[]) => ({
    games: rows.length,
    wins: rows.filter((r) => r.result === 2).length,
    goals: rows.reduce((s, r) => s + r.gf, 0),
    clean_sheets: rows.filter((r) => r.ga === 0).length,
    big_wins: rows.filter((r) => r.big_win).length,
    cup_games: rows.filter((r) => r.cup).length,
    cup_wins: rows.filter((r) => r.cup && r.advanced).length,
  });
  const d = league();
  const lg = Array.from({ length: 18 }, (_, i) => leagueRoundPoints(d, i + 1)).flat().filter((x) => x.club_id === A).map((x) => ({ ...x, cup: false }));
  const start = Date.UTC(2026, 0, 1, 16);
  const cup: CupRow = { id: 903, kind: 0, size: 32, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 8.25 * 3600_000).toISOString(), closed_at: null, champion: null };
  const e = (slot: number, id: string): CupEntry => ({ slot, club_id: id, xp: null, reach: null, coins: null, clubs: { name: `C${slot}`, tag: `C${String(slot).padStart(2, "0")}`, crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21021021021012" } });
  const cd = buildCupData({ cup, entries: [e(4, A)], logs: [], changes: [] });
  const cp = Array.from({ length: 5 }, (_, i) => cupRoundPoints(cd, i + 1)).flat().map((x) => ({ ...x, cup: true }));
  const novo = agg([...lg, ...cp]);
  // antigo: tabela da liga + estatísticas da copa, calculadas no aparelho
  const st = clubLeagueStats(d, A, Number.POSITIVE_INFINITY);
  const cs = cupStats(cd, 4);
  assert.deepEqual(novo, {
    games: st.games + cs.games,
    wins: st.wins + cs.wins,
    goals: st.goals_for + cs.goals_for,
    clean_sheets: st.clean_sheets + cs.clean_sheets,
    big_wins: st.big_wins + cs.big_wins,
    cup_games: cs.games,
    cup_wins: cs.cup_wins,
  });
});
