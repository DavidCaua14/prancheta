import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFriendlyData, friendlyMatch, friendlyState, inviteLink, type FriendlyRow } from "@/lib/friendly/core";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const K = Date.UTC(2026, 5, 10, 23); // 20h em Brasília

function data(over: Partial<FriendlyRow> = {}, changes: { club_id: string; tick: number; change: string }[] = [], logs: { club_id: string; at: string; lineup: string }[] = []) {
  const f: FriendlyRow = { id: 7, code: "RESENHA-7K2Q", host: A, guest: B, kickoff: new Date(K).toISOString(), host_xp: null, guest_xp: null, accepted_at: new Date(K - 3600_000).toISOString(), ...over };
  return buildFriendlyData({
    f,
    clubs: [
      { id: A, name: "Tubarões da Vila", tag: "TUV", crest: "0.1.3.11.0.5", kit: "1.11.0.5", squad: "1:21201201201123" },
      { id: B, name: "Grêmio Resenha", tag: "GRE", crest: "2.3.1.4.2.1", kit: "2.4.1.3", squad: "1:10210210210211" },
    ],
    logs,
    lots: [],
    changes,
  });
}

test("amistoso: quem convida é o mandante; o jogo é igual nos dois aparelhos", () => {
  const m = friendlyMatch(data());
  assert.equal(m.home.clubId, A);
  assert.equal(m.away.clubId, B);
  assert.equal(m.kickoff, K);
  assert.equal(m.round, 1);
  const again = friendlyMatch(data());
  assert.deepEqual(again.result.score, m.result.score);
  assert.deepEqual(again.result.events.map((e) => `${e.tick}${e.type}${e.team}`), m.result.events.map((e) => `${e.tick}${e.type}${e.team}`));
  // outro amistoso entre os mesmos clubes é outro jogo
  const other = friendlyMatch(data({ id: 8 }));
  assert.notDeepEqual(other.result.events.map((e) => `${e.tick}${e.type}`), m.result.events.map((e) => `${e.tick}${e.type}`));
});

test("amistoso: mudanças ao vivo e escalação salva valem para o clube certo", () => {
  const base = friendlyMatch(data());
  const withSub = friendlyMatch(data({}, [{ club_id: B, tick: 30, change: "x0b" }]));
  const sub = withSub.result.events.find((e) => e.type === "sub");
  assert.ok(sub, "a substituição aparece");
  assert.equal(sub!.team, 1);
  assert.equal(sub!.tick, 30);
  assert.deepEqual(base.result.events.filter((e) => e.tick < 30).map((e) => e.type), withSub.result.events.filter((e) => e.tick < 30).map((e) => e.type));
  // escalação salva antes do apito vale; a salva depois, não
  const lu = "1:9:01234567a98:211:5a";
  const before = friendlyMatch(data({}, [], [{ club_id: A, at: new Date(K - 60_000).toISOString(), lineup: lu }]));
  const after = friendlyMatch(data({}, [], [{ club_id: A, at: new Date(K + 60_000).toISOString(), lineup: lu }]));
  assert.equal(before.homeLineup.formation, 9);
  assert.equal(after.homeLineup.formation, base.homeLineup.formation);
});

test("amistoso: XP congelado no aceite muda a força", () => {
  const cold = friendlyMatch(data());
  const hot = friendlyMatch(data({ host_xp: Array.from({ length: 14 }, () => 30000) }));
  const ovr = (m: ReturnType<typeof friendlyMatch>) => m.home.squad.reduce((a, c) => a + c.overall, 0);
  assert.ok(ovr(hot) > ovr(cold));
});

test("amistoso: situações do convite", () => {
  const f = { guest: null, kickoff: new Date(K).toISOString() };
  assert.equal(friendlyState(f, K - 60_000), "waiting");
  assert.equal(friendlyState(f, K - 10_000), "expired");
  const g = { guest: B, kickoff: new Date(K).toISOString() };
  assert.equal(friendlyState(g, K - 1), "scheduled");
  assert.equal(friendlyState(g, K + 60_000), "live");
  assert.equal(friendlyState(g, K + 11 * 60_000), "done");
  assert.equal(inviteLink("https://prancheta.gg", "RESENHA-7K2Q"), "https://prancheta.gg/amistosos?c=RESENHA-7K2Q");
});
