/**
 * Quadro animado da partida: o "filme" precisa bater com a narração e fazer
 * sentido como futebol. Percorre partidas inteiras quadro a quadro.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { botTeam } from "@/lib/league/bots";
import { buildPlan, distToSegment, frameAt, PITCH_H, PITCH_W, scoreAtTime, visibleEvents } from "@/lib/sim/board";
import { simulate, type MatchEvent } from "@/lib/sim/engine";

const SHOTS = ["goal", "save", "miss", "post", "block", "penalty_goal", "penalty_miss"];
const GAMES = 24;

function games() {
  return Array.from({ length: GAMES }, (_, g) => {
    const a = botTeam(10 + g, g % 10, g % 6);
    const b = botTeam(500 + g, (g + 4) % 10, (g + 3) % 6);
    const res = simulate({ seed: g * 31 + 5, home: { name: "A", short: "A", squad: a.squad, lineup: a.lineup, ai: true }, away: { name: "B", short: "B", squad: b.squad, lineup: b.lineup, ai: true } });
    return { res, plan: buildPlan(res, a, b, g) };
  });
}
const all = games();

/** instante (minuto contínuo) do trecho do lance `e`, na fração q do trecho */
function at(events: MatchEvent[], e: MatchEvent, q: number) {
  const same = events.filter((x) => x.tick === e.tick && SHOTS.includes(x.type));
  return e.tick - 1 + (same.indexOf(e) + q) / same.length;
}

test("cada lance termina como a narração diz (gol na rede, defesa no goleiro, fora fora)", () => {
  let n = 0;
  for (const { res, plan } of all) {
    for (const e of res.events) {
      if (!SHOTS.includes(e.type) || e.team === undefined) continue;
      n++;
      const i = res.events.indexOf(e);
      // o quadro no instante em que a narração mostra o lance
      const fr = frameAt(plan, plan.eventAt[i] - 0.003);
      // 2º tempo: os times trocam de lado
      const flipped = e.tick - 1 >= res.secondHalfTick - 1;
      const goalX = (e.team === 0) !== flipped ? PITCH_W : 0;
      const gk = fr.dots.find((d) => d.team !== e.team && d.gk)!;
      const inMouth = Math.abs(fr.ball.y - PITCH_H / 2) <= 3.6;
      const where = `${e.type} ${e.tick}' bola ${fr.ball.x.toFixed(1)},${fr.ball.y.toFixed(1)}`;
      if (e.type === "goal" || e.type === "penalty_goal") assert.ok(Math.abs(fr.ball.x - goalX) < 1.6 && inMouth, where);
      if (e.type === "save" || e.type === "penalty_miss") assert.ok(Math.hypot(fr.ball.x - gk.x, fr.ball.y - gk.y) < 3, where);
      if (e.type === "miss") assert.ok(Math.abs(fr.ball.x - goalX) < 2 && !inMouth, where);
      if (e.type === "block") assert.ok(fr.dots.some((d) => d.team !== e.team && Math.hypot(d.x - fr.ball.x, d.y - fr.ball.y) < 3.2), where);
    }
  }
  assert.ok(n > 400, `${n} lances conferidos`);
});

test("chute para fora ou na trave nunca atravessa o goleiro", () => {
  for (const { res, plan } of all) {
    for (const e of res.events) {
      if ((e.type !== "miss" && e.type !== "post") || e.team === undefined) continue;
      for (let q = 0.68; q <= 0.9; q += 0.01) {
        const fr = frameAt(plan, at(res.events, e, q));
        const gk = fr.dots.find((d) => d.team !== e.team && d.gk)!;
        assert.ok(Math.hypot(fr.ball.x - gk.x, fr.ball.y - gk.y) >= 2.6, `${e.type} ${e.tick}'`);
      }
    }
  }
});

test("bola em passes curtos, sem atravessar adversários, jogadores dentro do campo", () => {
  let passes = 0;
  let crossed = 0;
  let jumps = 0;
  for (const { res, plan } of all) {
    let prev = frameAt(plan, 0);
    for (let t = 0.02; t < res.length + 0.9; t += 0.02) {
      const fr = frameAt(plan, t);
      for (const d of fr.dots) if (!d.hidden) assert.ok(d.x >= -0.5 && d.x <= PITCH_W + 0.5 && d.y >= 0 && d.y <= PITCH_H, `jogador fora do campo em ${t.toFixed(2)}`);
      const segN = plan.minutes[Math.floor(t)]?.length ?? 1;
      const boundary = Math.abs(t - Math.round(t)) < 0.021;
      if (!boundary && Math.hypot(fr.ball.x - prev.ball.x, fr.ball.y - prev.ball.y) > 8 * segN) jumps++;
      if (fr.pass && !prev.pass) {
        passes++;
        const p = fr.pass;
        assert.ok(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) <= 40, `passe longo em ${t.toFixed(2)}`);
        const team = fr.dots.find((d) => Math.hypot(d.x - p.x1, d.y - p.y1) < 0.5)?.team;
        if (team !== undefined && fr.dots.some((d) => !d.hidden && d.team !== team && distToSegment(d.x, d.y, p.x1, p.y1, p.x2, p.y2) < 1.8)) crossed++;
      }
      prev = fr;
    }
  }
  assert.ok(crossed / passes < 0.06, `${((crossed / passes) * 100).toFixed(1)}% dos passes passam por um adversário`);
  // emendas raras entre dois lances no mesmo minuto (a tela suaviza)
  assert.ok(jumps / GAMES < 6, `${(jumps / GAMES).toFixed(1)} emendas por jogo`);
});

test("depois de gol, saída de bola no meio-campo", () => {
  for (const { res, plan } of all) {
    for (const e of res.events) {
      if ((e.type !== "goal" && e.type !== "penalty_goal") || e.tick >= res.length - 1) continue;
      // se ainda houve outro lance no mesmo minuto (saída e contra-ataque), a bola já não está no meio
      const later = res.events.filter((x) => x.tick === e.tick && SHOTS.includes(x.type));
      if (later[later.length - 1] !== e) continue;
      const fr = frameAt(plan, e.tick + 0.05);
      assert.ok(Math.abs(fr.ball.x - PITCH_W / 2) < 4 && Math.abs(fr.ball.y - PITCH_H / 2) < 4, `saída depois do gol de ${e.tick}'`);
    }
  }
});

test("narração em sincronia: cada lance aparece quando a bola chega, na ordem do minuto", () => {
  let doubles = 0;
  for (const { res, plan } of all) {
    res.events.forEach((e, i) => {
      // nunca depois do minuto do lance, nunca antes do minuto anterior
      assert.ok(plan.eventAt[i] <= e.tick + 1e-9 && plan.eventAt[i] >= e.tick - 1, `${e.type} ${e.tick}'`);
    });
    const byTick = new Map<number, number[]>();
    res.events.forEach((e, i) => {
      if (SHOTS.includes(e.type)) byTick.set(e.tick, [...(byTick.get(e.tick) ?? []), i]);
    });
    for (const list of byTick.values()) {
      if (list.length < 2) continue;
      doubles++;
      for (let j = 1; j < list.length; j++) assert.ok(plan.eventAt[list[j]] > plan.eventAt[list[j - 1]] + 0.3, "dois lances no mesmo minuto aparecem em sequência");
    }
    // o placar nunca mostra o gol antes de a bola entrar
    res.events.forEach((e, i) => {
      if ((e.type !== "goal" && e.type !== "penalty_goal") || e.team === undefined) return;
      const before = scoreAtTime(plan, res.events, plan.eventAt[i] - 0.01);
      const after = scoreAtTime(plan, res.events, plan.eventAt[i]);
      assert.equal(after[e.team], before[e.team] + 1);
      assert.ok(visibleEvents(plan, res.events, plan.eventAt[i] - 0.01).indexOf(e) < 0);
    });
    assert.deepEqual(scoreAtTime(plan, res.events, res.length + 1), res.score);
  }
  assert.ok(doubles > 5, `${doubles} minutos com dois lances conferidos`);
});

test("intervalo: os times trocam de lado no 2º tempo", () => {
  for (const { res, plan } of all) {
    const gk1 = frameAt(plan, 10.5).dots.find((d) => d.team === 0 && d.gk)!;
    const gk2 = frameAt(plan, res.secondHalfTick + 0.5).dots.find((d) => d.team === 0 && d.gk)!;
    assert.ok(gk1.x < 10, "1º tempo: goleiro do mandante na esquerda");
    assert.ok(gk2.x > PITCH_W - 10, "2º tempo: goleiro do mandante na direita");
    assert.equal(frameAt(plan, 10.5).flipped, false);
    assert.equal(frameAt(plan, res.secondHalfTick + 0.5).flipped, true);
  }
});
