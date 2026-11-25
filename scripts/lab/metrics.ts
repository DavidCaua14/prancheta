// Métricas do quadro animado em 40 partidas (npm run lab:metrics).
// Métricas do roteiro do quadro em muitas partidas.
import { botTeam } from "@/lib/league/bots";
import { buildPlan, frameAt } from "@/lib/sim/board";
import { simulate } from "@/lib/sim/engine";
const N = 40;
let passes = 0, pingpong = 0, goals = 0, sudden = 0; const buildups: number[] = []; let turnovers = 0, turnoverJump = 0; let still = 0, holdSamples = 0;
for (let g = 0; g < N; g++) {
  const a = botTeam(10 + g, g % 10, g % 6), b = botTeam(500 + g, (g + 4) % 10, (g + 3) % 6);
  const res = simulate({ seed: g * 31 + 5, home: { name: "A", short: "A", squad: a.squad, lineup: a.lineup, ai: true }, away: { name: "B", short: "B", squad: b.squad, lineup: b.lineup, ai: true } });
  const plan = buildPlan(res, a, b, g);
  // sequência de donos da bola (por time), para achar vai-e-volta
  const segs = plan.minutes.flatMap((list, k) => list.map((s) => ({ ...s, k })));
  let hist: { team: number; who: number }[] = [];
  for (const s of segs) {
    if (hist.length && hist[hist.length - 1].team !== s.team) hist = [];
    if (s.start >= 0 && (!hist.length || hist[hist.length - 1].who !== s.start)) hist.push({ team: s.team, who: s.start });
    for (const p of s.passes) {
      passes++;
      if (hist.length >= 2 && hist[hist.length - 2].who === p.to) pingpong++;
      hist.push({ team: s.team, who: p.to });
    }
  }
  // tempo de posse antes de cada gol (construção)
  res.events.forEach((e, i) => {
    if (e.type !== "goal" || e.team === undefined) return;
    goals++;
    const at = plan.eventAt[i];
    let t = at, own = 0;
    while (t > 0) {
      const k = Math.floor(t - 1e-6), fm = t - 1e-6 - k;
      const seg = plan.minutes[k].find((s) => fm < s.to) ?? plan.minutes[k][0];
      if (seg.team !== e.team || seg.kind === "pause") break;
      const dt = Math.max(0.02, fm - seg.from + 1e-6);
      own += dt; t -= dt;
      if (own > 4) break;
    }
    buildups.push(own);
    if (own < 0.8) sudden++;
  });
  // trocas de posse: quanto a bola "pula" para o novo dono
  for (let k = 1; k < plan.minutes.length - 1; k++) {
    const s = plan.minutes[k][0], prev = plan.minutes[k - 1][plan.minutes[k - 1].length - 1];
    if (s.team === prev.team || s.kickoff || s.kind === "kickoff") continue;
    turnovers++;
    const a1 = frameAt(plan, k - 0.002).ball, b1 = frameAt(plan, k + 0.02).ball;
    if (Math.hypot(a1.x - b1.x, a1.y - b1.y) > 10) turnoverJump++;
  }
  // bola parada: quanto o dono fica sem sair do lugar
  for (let t = 1; t < res.length; t += 0.05) {
    const f1 = frameAt(plan, t), f2 = frameAt(plan, t + 0.05);
    if (!f1.pass && !f2.pass) { holdSamples++; if (Math.hypot(f1.ball.x - f2.ball.x, f1.ball.y - f2.ball.y) < 0.3) still++; }
  }
}
buildups.sort((x, y) => x - y);
console.log(`passes ${passes} · vai-e-volta ${((pingpong / passes) * 100).toFixed(1)}%`);
console.log(`gols ${goals} · posse antes do gol: mediana ${buildups[Math.floor(buildups.length / 2)].toFixed(2)} min, ${((sudden / goals) * 100).toFixed(0)}% com menos de 0,8 min`);
console.log(`trocas de posse ${turnovers} · ${((turnoverJump / turnovers) * 100).toFixed(0)}% com a bola pulando > 10`);
console.log(`bola parada no pé (sem conduzir): ${((still / holdSamples) * 100).toFixed(0)}% do tempo`);
