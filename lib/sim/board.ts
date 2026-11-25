/**
 * Quadro tático animado da partida: transforma os lances do motor num
 * "filme" de bolinhas no campo, sincronizado com a narração.
 *
 * Ideia: o motor já calculou a partida inteira. Para cada minuto montamos um
 * roteiro (quem tem a bola, quem passa para quem, quem chuta e para onde) e
 * o desenho de qualquer instante é uma função pura do tempo — `frameAt`.
 *
 * Regras de coerência:
 *  • a bola só anda em passes curtos entre companheiros (nunca cruza o campo),
 *    evitando linhas de passe que atravessam adversários;
 *  • o lance narrado no minuto T é encenado no minuto T−1 → T e termina
 *    exatamente quando o texto aparece (gol, defesa, trave, fora, bloqueio);
 *  • chute para fora vai para o lado oposto ao goleiro (não atravessa ninguém);
 *  • defesa termina nas mãos do goleiro; gol termina dentro da rede;
 *  • depois de gol, saída de bola no meio-campo.
 *
 * Coordenadas: campo 100 × 64. O mandante ataca para a direita.
 */
import { hash32, rng, type BaseCard, type Position } from "@/lib/cards/generate";
import { FORMATIONS } from "@/lib/tactics/formations";
import type { Lineup } from "@/lib/tactics/lineup";
import type { MatchEvent, MatchResult } from "./engine";

export const PITCH_W = 100;
export const PITCH_H = 64;
const MID_W = PITCH_H / 2;
/** boca do gol (largura) no eixo lateral */
const GOAL_HALF = 3.6;

export type BoardSide = { lineup: Lineup; squad: BaseCard[] };

type Slot = { role: Position; d0: number; w0: number };
type Pass = { at: number; to: number; dur: number };
type Outcome = "goal" | "save" | "miss" | "post" | "block" | "penalty_goal" | "penalty_miss";

type MinutePlan = {
  /** trecho do minuto ocupado por este roteiro (um minuto pode ter dois lances) */
  from: number;
  to: number;
  kind: "ambient" | "attack" | "kickoff" | "pause" | "end";
  /** começa com saída de bola no meio-campo (início, 2º tempo, depois de gol) */
  kickoff?: boolean;
  team: 0 | 1;
  /** profundidade da bola (no sentido de ataque de `team`) no começo e no fim do minuto */
  p0: number;
  p1: number;
  /** quem começa com a bola e os passes do minuto */
  start: number;
  passes: Pass[];
  attack?: {
    outcome: Outcome;
    shooter: number;
    /** alvo do chute (lateral) */
    aimW: number;
    /** goleiro e bloqueador (vagas do time que defende) */
    keeper: number;
    blocker: number;
    /** quem dá o último passe (avança junto com o finalizador) */
    feeder: number;
    corner: "before" | "after" | null;
    cornerSide: number;
  };
};

export type Overlay = { kind: "yellow" | "red" | "sub" | "injury" | "goal"; team: 0 | 1; slot: number; until: number; from: number };

export type BoardPlan = {
  slots: [Slot[], Slot[]];
  minutes: MinutePlan[][];
  /** vaga ocupada por cada carta, por minuto (troca nas substituições) */
  outFrom: [Map<number, number>, Map<number, number>];
  overlays: Overlay[];
  length: number;
  secondHalfTick: number;
  formation: [string, string];
  /**
   * Instante (minuto contínuo) em que cada lance da narração deve aparecer —
   * o mesmo índice de `result.events`. Lance de ataque: quando a bola chega
   * (rede, goleiro, fora...). Cartão/substituição: quando aparece no campo.
   */
  eventAt: number[];
};

export type BoardDot = { team: 0 | 1; slot: number; x: number; y: number; gk: boolean; hidden: boolean };
export type BoardFrame = {
  dots: BoardDot[];
  ball: { x: number; y: number };
  /** passe em andamento (para desenhar a linha tracejada) */
  pass: { x1: number; y1: number; x2: number; y2: number } | null;
  overlays: { kind: Overlay["kind"]; x: number; y: number; team: 0 | 1 }[];
  flash: "goal" | null;
  /** 2º tempo: os times trocaram de lado (mandante ataca para a esquerda) */
  flipped: boolean;
};

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
/** fração do trecho em que sai o chute e em que a bola chega (o texto aparece aqui) */
const SHOOT_AT = 0.68;
const ARRIVE_AT = 0.9;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ------------------------------------------------------------------ */
/* Formação → posições base                                            */
/* ------------------------------------------------------------------ */

function slotsOf(lineup: Lineup): Slot[] {
  return FORMATIONS[lineup.formation].slots.map((s) => ({
    role: s.role,
    // profundidade: 0 = linha do próprio gol, 100 = gol rival
    d0: s.role === "GOL" ? 3.5 : 6 + (90 - s.spot[1]) * 0.62,
    // largura: lado direito de quem ataca = baixo da tela para o mandante
    w0: 5 + (s.spot[0] / 100) * (PITCH_H - 10),
  }));
}

/** profundidade/largura (no sentido do time) → coordenadas da tela */
function toScreen(team: 0 | 1, d: number, w: number) {
  return team === 0 ? { x: d, y: w } : { x: PITCH_W - d, y: PITCH_H - w };
}

/* ------------------------------------------------------------------ */
/* Plano                                                                */
/* ------------------------------------------------------------------ */

const ATTACK_TYPES = new Set(["goal", "save", "miss", "post", "block", "penalty_goal", "penalty_miss"]);

export function buildPlan(result: MatchResult, home: BoardSide, away: BoardSide, seed: number): BoardPlan {
  const slots: [Slot[], Slot[]] = [slotsOf(home.lineup), slotsOf(away.lineup)];
  const sides = [home, away];
  // carta → vaga, acompanhando as substituições
  const cardSlot = [new Map<number, number>(), new Map<number, number>()];
  sides.forEach((s, t) => s.lineup.xi.forEach((c, k) => cardSlot[t].set(c, k)));
  const outFrom: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  const overlays: Overlay[] = [];

  const byTick = new Map<number, MatchEvent[]>();
  for (const e of result.events) {
    const list = byTick.get(e.tick) ?? [];
    list.push(e);
    byTick.set(e.tick, list);
  }
  const slotOf = (team: 0 | 1, card: number | undefined) => (card === undefined ? -1 : cardSlot[team].get(card) ?? -1);
  // quando cada lance aparece na narração (padrão: no minuto do lance)
  const eventAt = result.events.map((e) => e.tick);
  const indexOf = new Map(result.events.map((e, i) => [e, i]));
  const showAt = (e: MatchEvent, t: number) => {
    const i = indexOf.get(e);
    if (i !== undefined) eventAt[i] = t;
  };

  // posse "de fundo" quando não há lance: proporção da posse final
  const possHome = (result.stats[0].possession || 50) / 100;
  const minutes: MinutePlan[][] = [];
  let carry = { team: 0 as 0 | 1, p: 50, holder: -1, kickoff: true };
  /** quem dá a saída de bola: o mais adiantado em campo */
  const kickerOf = (t: 0 | 1) => slots[t].reduce((best, sl, j) => (sl.role !== "GOL" && !outFrom[t].has(j) && sl.d0 > (slots[t][best]?.d0 ?? -1) ? j : best), 0);
  /** lado do último escanteio (o escanteio cobrado é o mesmo que saiu) */
  let lastCorner = -1;

  const shape = { slots } as unknown as BoardPlan;
  /**
   * Companheiro para receber o passe: perto da profundidade desejada, sem
   * passe longo demais e sem adversário no caminho da bola.
   */
  const pickNear = (r: () => number, team: 0 | 1, depth: number, from: number, wantW?: number, time = 0) => {
    const at = (tm: 0 | 1, k: number) => {
      const p = slotPos(shape, tm, k, team, depth, MID_W, time);
      return toScreen(tm, p.d, p.w);
    };
    const opp = (1 - team) as 0 | 1;
    const opps = slots[opp].map((_, k) => at(opp, k));
    const a0 = from >= 0 ? at(team, from) : null;
    const cands = slots[team]
      .map((s, k) => ({ k, s }))
      .filter(({ k, s }) => k !== from && s.role !== "GOL" && !outFrom[team].has(k))
      .map(({ k, s }) => {
        let score = Math.abs(s.d0 + 14 - depth) + (wantW !== undefined ? Math.abs(s.w0 - wantW) * 0.35 : 0) + r() * 9;
        if (a0) {
          const b = at(team, k);
          const len = Math.hypot(b.x - a0.x, b.y - a0.y);
          if (len > 26) score += (len - 26) * 4; // nada de bola atravessando o campo
          const block = Math.min(...opps.map((o) => distToSegment(o.x, o.y, a0.x, a0.y, b.x, b.y)));
          if (block < 3.2) score += 40; // adversário no meio do caminho
        }
        return { k, score };
      })
      .sort((a, b) => a.score - b.score);
    return cands.length ? cands[0].k : from;
  };
  const posAt = (tm: 0 | 1, ballTeam: 0 | 1, k: number, depth: number, time: number) => {
    const p = slotPos(shape, tm, k, ballTeam, depth, MID_W, time);
    return toScreen(tm, p.d, p.w);
  };
  const passLen = (team: 0 | 1, a: number, b: number, depth: number, time: number) => {
    const p = posAt(team, team, a, depth, time);
    const q = posAt(team, team, b, depth, time);
    return Math.hypot(p.x - q.x, p.y - q.y);
  };
  /** próximo dono da bola no ataque: perto, mais à frente e sem adversário no caminho */
  const pickAhead = (r: () => number, team: 0 | 1, from: number, depth: number, time: number, exclude: number) => {
    const opp = (1 - team) as 0 | 1;
    const a0 = posAt(team, team, from, depth, time);
    const opps = slots[opp].map((_, j) => posAt(opp, team, j, depth, time));
    const dir = team === 0 ? 1 : -1;
    let best = -1;
    let bestScore = Infinity;
    slots[team].forEach((s, j) => {
      if (j === from || j === exclude || s.role === "GOL" || outFrom[team].has(j)) return;
      const b = posAt(team, team, j, depth, time);
      const len = Math.hypot(b.x - a0.x, b.y - a0.y);
      const gain = (b.x - a0.x) * dir;
      let score = -gain + r() * 6;
      if (len > 24) score += (len - 24) * 5;
      if (len < 6) score += 10;
      if (Math.min(...opps.map((o) => distToSegment(o.x, o.y, a0.x, a0.y, b.x, b.y))) < 3.2) score += 30;
      if (score < bestScore) {
        bestScore = score;
        best = j;
      }
    });
    return best;
  };

  for (let k = 0; k < result.length; k++) {
    const r = rng(hash32(`quadro:${seed}:${k}`));
    const evs = byTick.get(k + 1) ?? [];

    // substituições e expulsões valem a partir do minuto do lance
    for (const e of evs) {
      if (e.team === undefined) continue;
      const t = e.team;
      if (e.type === "sub" && e.player !== undefined && e.other !== undefined) {
        const s = slotOf(t, e.other);
        if (s >= 0) {
          cardSlot[t].delete(e.other);
          cardSlot[t].set(e.player, s);
          overlays.push({ kind: "sub", team: t, slot: s, from: k + 0.6, until: k + 2.2 });
        }
        showAt(e, k + 0.6);
      }
      if (e.type === "tactic") showAt(e, k + 0.6);
      if (e.type === "yellow" || e.type === "red" || e.type === "injury") {
        const s = slotOf(t, e.player);
        if (s >= 0) overlays.push({ kind: e.type, team: t, slot: s, from: k + 0.55, until: k + 2 });
        showAt(e, k + 0.55);
        if (e.type === "red" && s >= 0) outFrom[t].set(s, k + 1.4);
      }

    }

    // 2º tempo: saída de bola do visitante
    if (k + 1 === result.secondHalfTick) carry = { team: 1, p: 50, holder: -1, kickoff: true };

    const attacks = evs.filter((e) => ATTACK_TYPES.has(e.type) && e.team !== undefined);
    const segs: MinutePlan[] = [];
    if (attacks.length) {
      attacks.forEach((attackEv, i) => {
        const from = i / attacks.length;
        const to = (i + 1) / attacks.length;
        const t = attackEv.team as 0 | 1;
        const def = (1 - t) as 0 | 1;
        const shooter = Math.max(0, slotOf(t, attackEv.player));
        const assist = attackEv.type === "goal" ? slotOf(t, attackEv.other) : -1;
        const keeper = slots[def].findIndex((s) => s.role === "GOL");
        const blockers = slots[def].map((s, j) => ({ j, s })).filter(({ s, j }) => s.role !== "GOL" && !outFrom[def].has(j));
        const blocker = blockers.sort((x, y) => x.s.d0 - y.s.d0)[Math.floor(r() * Math.min(3, blockers.length))]?.j ?? 1;
        // escanteio do mesmo time logo antes (cabeçada) ou logo depois (desviou)
        const at = evs.indexOf(attackEv);
        const prevAttack = i > 0 ? evs.indexOf(attacks[i - 1]) : -1;
        const nextAttack = i < attacks.length - 1 ? evs.indexOf(attacks[i + 1]) : evs.length;
        const cornerBefore = evs.some((e, j) => e.type === "corner" && e.team === t && j > prevAttack && j < at);
        const cornerAfter = evs.some((e, j) => e.type === "corner" && e.team === t && j > at && j < nextAttack);
        const corner = cornerBefore ? "before" : cornerAfter ? "after" : null;
        const penalty = attackEv.type === "penalty_goal" || attackEv.type === "penalty_miss";
        const startP = carry.team === t ? carry.p : 100 - carry.p;
        const kickoff = carry.kickoff; // depois de gol a bola sempre recomeça no meio
        const plan: MinutePlan = { from, to, kind: "attack", kickoff, team: t, p0: carry.kickoff ? 50 : clamp(startP, 25, 70), p1: penalty ? 89 : 86, start: -1, passes: [] };
        plan.start = kickoff ? kickerOf(t) : carry.team === t && carry.holder >= 0 ? carry.holder : pickNear(r, t, plan.p0, -1, undefined, k);
        // a jogada: passes curtos para frente a partir de quem tem a bola; o último
        // passe (de quem dá a assistência, se houver) chega ao finalizador
        plan.passes = [];
        let holder = plan.start;
        if (!penalty && corner !== "before") {
          const steps = [0.1, 0.28];
          steps.forEach((at2, j) => {
            const depth = attackDepth(plan, at2);
            let next = pickAhead(r, t, holder, depth, k + at2, shooter);
            // o penúltimo passe vai para quem dá a assistência (quando ele está por perto)
            if (j === steps.length - 1 && assist >= 0 && assist !== shooter && assist !== holder && passLen(t, holder, assist, depth, k + at2) < 34) next = assist;
            if (next >= 0 && next !== holder) {
              plan.passes.push({ at: at2, to: next, dur: 0.1 });
              holder = next;
            }
          });
          if (holder !== shooter) plan.passes.push({ at: 0.46, to: shooter, dur: 0.1 });
        }
        // lado do chute: para fora/trave, o mesmo lado do atacante (o goleiro fica do outro)
        const shooterSide = slots[t][shooter].w0 - MID_W;
        const wide = attackEv.type === "miss" || attackEv.type === "post" || attackEv.type === "penalty_miss";
        const side = wide && Math.abs(shooterSide) > 2 ? Math.sign(shooterSide) : r() < 0.5 ? -1 : 1;
        let aimW = MID_W + side * (attackEv.type === "goal" || attackEv.type === "penalty_goal" ? 1 + r() * (GOAL_HALF - 1.4) : 0);
        if (attackEv.type === "miss") aimW = MID_W + side * (GOAL_HALF + 2 + r() * 4);
        if (attackEv.type === "post") aimW = MID_W + side * GOAL_HALF;
        if (attackEv.type === "save" || attackEv.type === "penalty_miss") aimW = MID_W + side * (0.6 + r() * 2.2);
        // escanteio: sai pelo lado do chute; cobrado do mesmo lado em que saiu
        const cornerSide = corner === "before" && lastCorner >= 0 ? lastCorner : aimW > MID_W ? PITCH_H - 4 : 4;
        lastCorner = corner === "after" ? cornerSide : -1;
        plan.attack = { outcome: attackEv.type as Outcome, shooter, aimW, keeper, blocker, feeder: holder === shooter ? plan.start : holder, corner, cornerSide };
        segs.push(plan);
        // narração em sincronia com o quadro: o texto sai quando a bola chega
        const arrive = k + from + ARRIVE_AT * (to - from);
        showAt(attackEv, arrive);
        if (attackEv.type === "goal" || attackEv.type === "penalty_goal") {
          overlays.push({ kind: "goal", team: t, slot: shooter, from: arrive, until: arrive + 0.9 });
        }
        evs.forEach((e, j) => {
          if (e.type !== "corner" || e.team !== t) return;
          if (corner === "before" && j > prevAttack && j < at) showAt(e, k + from + 0.04 * (to - from));
          if (corner === "after" && j > at && j < nextAttack) showAt(e, k + from + 0.99 * (to - from));
        });
        carry =
          attackEv.type === "goal" || attackEv.type === "penalty_goal"
            ? { team: def, p: 50, holder: -1, kickoff: true }
            : corner === "after"
              ? { team: def, p: 10, holder: -1, kickoff: false } // escanteio afastado pela defesa
              : attackEv.type === "block"
              ? { team: def, p: 18, holder: blocker, kickoff: false }
              : { team: def, p: 8, holder: keeper, kickoff: false };
      });
    } else {
      // minuto sem lance de ataque: troca de passes no meio-campo
      // posse: quem está com a bola costuma continuar; senão, sorteio pela posse do jogo
      let t: 0 | 1 = carry.team;
      if (!carry.kickoff && r() >= 0.62) t = r() < possHome ? 0 : 1;
      const keep = t === carry.team;
      const plan: MinutePlan = {
        from: 0,
        to: 1,
        team: t,
        kind: carry.kickoff ? "kickoff" : "ambient",
        p0: carry.kickoff ? 50 : keep ? carry.p : clamp(100 - carry.p, 25, 75),
        p1: 0,
        start: -1,
        passes: [],
      };
      plan.p1 = clamp(plan.p0 + (r() * 30 - 10), 22, 70);
      // saída de bola: quem está mais adiantado (perto do círculo central) dá a saída
      plan.kickoff = carry.kickoff;
      plan.start = carry.kickoff ? kickerOf(t) : keep && carry.holder >= 0 ? carry.holder : pickNear(r, t, plan.p0, -1, undefined, k);
      let prev = plan.start;
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const at = 0.1 + (i * 0.8) / n + r() * 0.06;
        const target = lerp(plan.p0, plan.p1, (i + 1) / n);
        const to = pickNear(r, t, target, prev, clamp(slots[t][Math.max(prev, 0)]?.w0 ?? MID_W, 8, PITCH_H - 8) + (r() * 30 - 15), k + at);
        plan.passes.push({ at, to, dur: 0.11 });
        prev = to;
      }
      segs.push(plan);
      carry = { team: t, p: plan.p1, holder: prev, kickoff: false };
    }
    if (evs.some((e) => e.type === "fulltime")) carry = { ...carry, kickoff: false };
    minutes.push(segs);
  }
  // minuto extra parado depois do apito final
  minutes.push([{ from: 0, to: 1, kind: "end", team: 0, p0: 50, p1: 50, start: -1, passes: [] }]);
  return {
    slots,
    minutes,
    outFrom,
    overlays,
    length: result.length,
    secondHalfTick: result.secondHalfTick,
    formation: [FORMATIONS[home.lineup.formation].name, FORMATIONS[away.lineup.formation].name],
    eventAt,
  };
}

/** Lances da narração já visíveis no instante `t` (em sincronia com o quadro). */
export function visibleEvents(plan: BoardPlan, events: MatchEvent[], t: number): MatchEvent[] {
  return events.filter((_, i) => plan.eventAt[i] <= t);
}

/** Placar no instante `t`: só os gols que o quadro já mostrou entrando. */
export function scoreAtTime(plan: BoardPlan, events: MatchEvent[], t: number): [number, number] {
  const s: [number, number] = [0, 0];
  events.forEach((e, i) => {
    if ((e.type === "goal" || e.type === "penalty_goal") && e.team !== undefined && plan.eventAt[i] <= t) s[e.team]++;
  });
  return s;
}

/* ------------------------------------------------------------------ */
/* Desenho de um instante                                              */
/* ------------------------------------------------------------------ */

/** profundidade da bola no ataque: sobe junto com os passes até o chute */
function attackDepth(m: Pick<MinutePlan, "p0" | "p1">, f: number) {
  return lerp(m.p0, m.p1, clamp(f / 0.62, 0, 1));
}

/** posição de uma vaga num instante, dado onde a bola "está" no plano */
function slotPos(plan: BoardPlan, team: 0 | 1, slot: number, ballTeam: 0 | 1, ballD: number, ballW: number, t: number) {
  const s = plan.slots[team][slot];
  const wob = Math.sin(t * 2.1 + slot * 1.7 + team * 3.1) * 0.9;
  const wob2 = Math.cos(t * 1.7 + slot * 2.3 + team) * 0.8;
  if (s.role === "GOL") {
    // goleiro: perto do gol, acompanhando um pouco o lado da bola
    const myBallD = ballTeam === team ? ballD : 100 - ballD;
    const d = 3.5 + (myBallD > 70 ? 0 : 1.2);
    const lat = ballTeam === team ? ballW : PITCH_H - ballW;
    return { d, w: clamp(MID_W + (lat - MID_W) * 0.12, MID_W - 3, MID_W + 3) };
  }
  let d: number;
  if (team === ballTeam) {
    // quem tem a bola sobe junto com ela
    d = clamp(s.d0 + (ballD - 38) * 0.55, s.d0 - 6, s.role === "ZAG" ? 62 : 90);
  } else {
    // quem defende recua conforme a bola se aproxima do seu gol
    const danger = 100 - ballD;
    d = clamp(s.d0 + (danger - 52) * 0.5, 6, s.role === "ATA" ? 62 : 55);
  }
  const lateralBall = team === 0 ? ballW : PITCH_H - ballW;
  const w = clamp(s.w0 + (lateralBall - MID_W) * 0.28, 3, PITCH_H - 3);
  return { d: d + wob, w: w + wob2 };
}

export function frameAt(plan: BoardPlan, t: number): BoardFrame {
  const k = clamp(Math.floor(t), 0, plan.minutes.length - 1);
  const fm = clamp(t - k, 0, 1);
  const segs = plan.minutes[k];
  const m = segs.find((sg) => fm < sg.to) ?? segs[segs.length - 1];
  // tempo local dentro do trecho (0 → 1)
  const f = clamp((fm - m.from) / (m.to - m.from), 0, 1);
  const team = m.team;
  const def = (1 - team) as 0 | 1;

  // profundidade/largura "planejadas" da bola (move as linhas dos times)
  let ballD = m.kind === "attack" ? attackDepth(m, f) : lerp(m.p0, m.p1, ease(f));
  let ballW = MID_W;
  if (m.kind === "pause" || m.kind === "end") ballD = 50;

  // posições preliminares, para achar quem está com a bola
  const pos = (tm: 0 | 1, slot: number) => slotPos(plan, tm, slot, team, ballD, ballW, t);

  // quem está com a bola agora e passe em andamento
  let holder = m.start;
  let pass: { from: number; to: number; p: number } | null = null;
  for (const ps of m.passes) {
    if (f < ps.at) break;
    if (f < ps.at + ps.dur) {
      pass = { from: holder, to: ps.to, p: (f - ps.at) / ps.dur };
      break;
    }
    holder = ps.to;
  }

  const a = m.attack;
  const shootAt = SHOOT_AT;
  const arriveAt = ARRIVE_AT;
  const overrides = new Map<string, { d: number; w: number }>();
  let ball: { d: number; w: number; team: 0 | 1 } | null = null;

  if (m.kind === "attack" && a) {
    const penalty = a.outcome === "penalty_goal" || a.outcome === "penalty_miss";
    // finalizador entra na área
    const sh = plan.slots[team][a.shooter];
    const boxD = penalty ? 86 : 84 + (sh.role === "ATA" ? 3 : 0);
    const boxW = penalty ? MID_W : clamp(MID_W + (sh.w0 - MID_W) * 0.45, 18, PITCH_H - 18);
    const run = clamp((f - 0.36) / 0.28, 0, 1);
    const base = pos(team, a.shooter);
    const shooterPos = { d: lerp(base.d, boxD, ease(run)), w: lerp(base.w, boxW, ease(run)) };
    overrides.set(`${team}:${a.shooter}`, shooterPos);
    // quem dá o último passe chega perto da área antes (passe curto, sem lançamento do meio-campo)
    if (a.feeder !== a.shooter && a.feeder >= 0) {
      const fb = pos(team, a.feeder);
      const fr2 = clamp((f - 0.16) / 0.3, 0, 1);
      const fd = Math.max(fb.d, boxD - 16);
      const fw = lerp(fb.w, lerp(boxW, MID_W, 0.3) + (fb.w > boxW ? 8 : -8), 0.6);
      overrides.set(`${team}:${a.feeder}`, { d: lerp(fb.d, fd, ease(fr2)), w: lerp(fb.w, clamp(fw, 6, PITCH_H - 6), ease(fr2)) });
    }
    ballW = lerp(MID_W, boxW, run);

    if (penalty) {
      // pênalti: bola na marca, todo mundo fora da área
      ballD = 70;
      overrides.set(`${team}:${a.shooter}`, { d: 86, w: MID_W + 1.5 });
    }
    if (a.corner === "before") {
      // escanteio: bola sai da bandeirinha e vem para a área
      const cf = clamp(f / 0.62, 0, 1);
      if (f < shootAt) ball = { d: lerp(99, shooterPos.d, ease(cf)), w: lerp(a.cornerSide, shooterPos.w, ease(cf)), team };
    }

    // goleiro e bloqueador do time que defende (em coordenadas do atacante)
    const keeperD = 96.5;
    const shotFrom = penalty ? { d: 88, w: MID_W } : shooterPos;
    const toAim = { d: 100, w: a.aimW };
    const blockPoint = { d: lerp(boxD, 100, 0.35), w: lerp(boxW, a.aimW, 0.35) };
    if (a.outcome === "block") {
      // o zagueiro corre para a frente do chute
      const bf = clamp((f - 0.5) / 0.26, 0, 1);
      const b0 = pos(def, a.blocker);
      const target = { d: 100 - blockPoint.d - 0.2, w: PITCH_H - blockPoint.w };
      overrides.set(`${def}:${a.blocker}`, { d: lerp(b0.d, target.d, ease(bf)), w: lerp(b0.w, target.w, ease(bf)) });
    }
    if (a.corner === "before" && f >= 0.62 && f < shootAt) ball = { d: shooterPos.d + 1.2, w: shooterPos.w, team };
    // chute para fora: goleiro do lado contrário (a bola não passa por ele)
    const gkW = a.outcome === "miss" || a.outcome === "post" ? MID_W - Math.sign(a.aimW - MID_W) * 1.6 : MID_W;
    let gk = { d: keeperD, w: gkW };
    if (f >= shootAt) {
      const sf = clamp((f - shootAt) / (arriveAt - shootAt), 0, 1);
      if (a.outcome === "save" || a.outcome === "penalty_miss") {
        // defesa: o goleiro vai até a bola e segura
        const catchPt = { d: keeperD, w: lerp(shotFrom.w, toAim.w, (keeperD - shotFrom.d) / (100 - shotFrom.d)) };
        gk = { d: keeperD, w: lerp(gkW, catchPt.w, ease(sf)) };
        ball = { d: lerp(shotFrom.d, catchPt.d, sf), w: lerp(shotFrom.w, catchPt.w, sf), team };
      } else if (a.outcome === "goal" || a.outcome === "penalty_goal") {
        // gol: goleiro pula para o outro lado, bola morre na rede
        gk = { d: keeperD, w: lerp(MID_W, MID_W - Math.sign(a.aimW - MID_W || 1) * 3, ease(sf)) };
        ball = { d: lerp(shotFrom.d, 101.2, sf), w: lerp(shotFrom.w, a.aimW, sf), team };
      } else if (a.outcome === "block") {
        // bloqueio: a bola para no zagueiro que entrou na frente
        const bp = blockPoint;
        ball = { d: lerp(shotFrom.d, bp.d - 1.6, Math.min(1, sf * 1.4)), w: lerp(shotFrom.w, bp.w, Math.min(1, sf * 1.4)), team };
      } else if (a.outcome === "post") {
        // trave: bate no poste e volta
        const hit = Math.min(1, sf / 0.75);
        const back = Math.max(0, (sf - 0.75) / 0.25);
        ball = { d: lerp(lerp(shotFrom.d, 99.6, hit), 93, back), w: lerp(lerp(shotFrom.w, a.aimW, hit), a.aimW + Math.sign(a.aimW - MID_W) * 3, back), team };
      } else {
        // pra fora: passa ao lado da trave e sai pela linha de fundo
        ball = { d: lerp(shotFrom.d, 101.5, sf), w: lerp(shotFrom.w, a.aimW, sf), team };
      }
      if (f >= arriveAt && a.corner === "after") {
        const cf = clamp((f - arriveAt) / (1 - arriveAt), 0, 1);
        ball = { d: lerp(ball.d, 99.5, cf), w: lerp(ball.w, a.cornerSide, cf), team };
      }
    } else if (penalty) {
      ball = { d: 88, w: MID_W, team };
    }
    overrides.set(`${def}:${a.keeper}`, { d: 100 - gk.d, w: PITCH_H - gk.w });
  }

  // saída de bola: quem dá a saída está no círculo central
  if ((m.kind === "kickoff" || m.kickoff) && m.start >= 0 && f < (m.passes[0]?.at ?? 0.3) + 0.02) {
    overrides.set(`${team}:${m.start}`, { d: 49, w: MID_W + (team === 0 ? 1.5 : -1.5) });
  }

  // posições finais dos 22
  const dots: BoardDot[] = [];
  const screen: Record<string, { x: number; y: number }> = {};
  for (const tm of [0, 1] as const) {
    plan.slots[tm].forEach((s, slot) => {
      const key = `${tm}:${slot}`;
      const p = overrides.get(key) ?? pos(tm, slot);
      // pênalti: só o batedor e o goleiro dentro da área
      let d = p.d;
      if (m.kind === "attack" && a && (a.outcome === "penalty_goal" || a.outcome === "penalty_miss") && !overrides.has(key)) {
        d = tm === team ? Math.min(d, 80) : Math.max(d, 21);
      }
      const sc = toScreen(tm, d, p.w);
      screen[key] = sc;
      const off = plan.outFrom[tm].get(slot);
      dots.push({ team: tm, slot, x: sc.x, y: sc.y, gk: s.role === "GOL", hidden: off !== undefined && t >= off });
    });
  }

  // bola: com o dono, em passe, ou no roteiro do chute
  let bx: number;
  let by: number;
  let passLine: BoardFrame["pass"] = null;
  if (ball) {
    const sc = toScreen(ball.team, ball.d, ball.w);
    bx = sc.x;
    by = sc.y;
  } else if (m.kind === "pause" || m.kind === "end" || holder < 0) {
    bx = PITCH_W / 2;
    by = PITCH_H / 2;
  } else if (pass) {
    const a1 = screen[`${team}:${pass.from}`] ?? { x: PITCH_W / 2, y: PITCH_H / 2 };
    const b1 = screen[`${team}:${pass.to}`];
    bx = lerp(a1.x, b1.x, pass.p);
    by = lerp(a1.y, b1.y, pass.p);
    passLine = { x1: a1.x, y1: a1.y, x2: b1.x, y2: b1.y };
  } else {
    const h = screen[`${team}:${holder}`];
    const dir = team === 0 ? 1 : -1;
    bx = h.x + dir * 1.6;
    by = h.y + 0.6;
  }

  const overlays: BoardFrame["overlays"] = [];
  let flash: BoardFrame["flash"] = null;
  for (const o of plan.overlays) {
    if (t < o.from || t > o.until) continue;
    if (o.kind === "goal") {
      flash = "goal";
      continue;
    }
    const p = screen[`${o.team}:${o.slot}`];
    if (p) overlays.push({ kind: o.kind, x: p.x, y: p.y, team: o.team });
  }

  const ballOut = { x: clamp(bx, -1, PITCH_W + 1.5), y: clamp(by, 0.5, PITCH_H - 0.5) };
  // 2º tempo: os times trocam de lado (espelha tudo)
  const flipped = k >= plan.secondHalfTick - 1;
  if (flipped) {
    const fx = (x: number) => PITCH_W - x;
    const fy = (y: number) => PITCH_H - y;
    for (const d of dots) {
      d.x = fx(d.x);
      d.y = fy(d.y);
    }
    ballOut.x = fx(ballOut.x);
    ballOut.y = fy(ballOut.y);
    if (passLine) passLine = { x1: fx(passLine.x1), y1: fy(passLine.y1), x2: fx(passLine.x2), y2: fy(passLine.y2) };
    for (const o of overlays) {
      o.x = fx(o.x);
      o.y = fy(o.y);
    }
  }
  return { dots, ball: ballOut, pass: passLine, overlays, flash, flipped };
}

/* ------------------------------------------------------------------ */
/* Verificações de coerência (usadas nos testes)                       */
/* ------------------------------------------------------------------ */

/** Distância de um ponto até um segmento. */
export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy || 1;
  const u = clamp(((px - x1) * dx + (py - y1) * dy) / len, 0, 1);
  return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
}
