/**
 * Motor de simulação de partidas — minuto a minuto, no espírito do Brasfoot.
 *
 * DETERMINÍSTICO: mesma seed + mesmos times + mesmas mudanças = mesma partida,
 * lance a lance. Por isso o banco só precisa guardar a seed, as mudanças feitas
 * durante o jogo e o placar; qualquer aparelho "reassiste" recalculando.
 *
 * Duas fontes de aleatoriedade: uma para o JOGO e outra só para o TEXTO da
 * narração. Assim, mudar uma frase nunca muda um resultado.
 *
 * ⚠️ Mudanças nas regras alteram resultados de partidas antigas: suba
 * ENGINE_VERSION e guarde a versão junto com cada partida.
 */

import { rng, type BaseCard, type Position } from "@/lib/cards/generate";
import { FORMATIONS, fit, type Formation } from "@/lib/tactics/formations";
import type { Lineup } from "@/lib/tactics/lineup";
import { narrate } from "./narration";

export const ENGINE_VERSION = 1;

/* ================================================================== */
/* Tipos públicos                                                      */
/* ================================================================== */

export type TeamInput = {
  name: string;
  short: string;
  squad: BaseCard[];
  lineup: Lineup;
  /** IA do técnico: substituições e ajustes de postura automáticos. */
  ai?: boolean;
};

export type Change =
  | { minute: number; team: 0 | 1; kind: "tactic"; posture?: number; marking?: number; passing?: number; line?: number; width?: number; tempo?: number }
  | { minute: number; team: 0 | 1; kind: "sub"; out: number; in: number };

export type MatchInput = {
  seed: number;
  home: TeamInput;
  away: TeamInput;
  /** Mudanças feitas pelos técnicos durante o jogo (ordenadas por minuto). */
  changes?: Change[];
  /** Campo neutro: sem vantagem de mando. */
  neutral?: boolean;
};

export type EventType =
  | "kickoff"
  | "goal"
  | "penalty_goal"
  | "penalty_miss"
  | "save"
  | "miss"
  | "post"
  | "block"
  | "corner"
  | "yellow"
  | "red"
  | "sub"
  | "injury"
  | "tactic"
  | "halftime"
  | "fulltime";

export type MatchEvent = {
  /** minuto do relógio (1–90); acréscimos vão em `extra` */
  minute: number;
  extra?: number;
  /** minuto absoluto da simulação (para ordenar / reproduzir) */
  tick: number;
  type: EventType;
  team?: 0 | 1;
  /** índice da carta no elenco do time */
  player?: number;
  /** assistência, goleiro, quem entrou… depende do tipo */
  other?: number;
  text: string;
  score: [number, number];
};

export type TeamStats = {
  possession: number;
  shots: number;
  onTarget: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  saves: number;
  subs: number;
};

export type MatchResult = {
  version: number;
  score: [number, number];
  events: MatchEvent[];
  stats: [TeamStats, TeamStats];
  /** nota de 3 a 10 por carta que entrou em campo */
  ratings: [Record<number, number>, Record<number, number>];
  /** total de ticks simulados (90 + acréscimos) */
  length: number;
  /** minuto absoluto em que começa o 2º tempo */
  secondHalfTick: number;
};

/* ================================================================== */
/* Constantes de equilíbrio (ajustadas pelos testes em tests/sim.*)    */
/* ================================================================== */

export const TUNING = {
  homeBoost: 1.03,
  possessionExp: 2,
  attackChance: 0.4,
  shotBase: 0.6,
  shotExp: 1.4,
  blockChance: 0.18,
  onTargetBase: 0.42,
  onTargetSlope: 200,
  goalBase: 0.31,
  goalExp: 0.8,
  /** contra-ataque: chance por minuto conforme a postura de quem tem a bola */
  counterBase: 0.035,
  cornerChance: 0.22,
  cornerHeader: 0.2,
  penaltyChance: 0.02,
  penaltyConv: 0.76,
  foulChance: 0.16,
  yellowPerFoul: 0.22,
  redPerFoul: 0.002,
  injuryChance: 0.0007,
  drain: 0.42,
  gkDrain: 0.12,
  maxSubs: 5,
};

/** ataque, defesa, frequência de ataques, cansaço */
const POSTURE = [
  { att: 0.88, def: 1.4, freq: 0.8, tired: 0.9, poss: -0.04 },
  { att: 0.94, def: 1.15, freq: 0.9, tired: 0.95, poss: -0.02 },
  { att: 1, def: 1, freq: 1, tired: 1, poss: 0 },
  { att: 1.06, def: 0.9, freq: 1.08, tired: 1.06, poss: 0.02 },
  { att: 1.12, def: 0.8, freq: 1.15, tired: 1.14, poss: 0.04 },
];

/** defesa, posse, cansaço, faltas, cartões */
const MARKING = [
  { def: 0.98, poss: -0.01, tired: 0.85, fouls: 0.7, cards: 0.75 },
  { def: 1, poss: 0, tired: 1, fouls: 1, cards: 1 },
  { def: 1.05, poss: 0.03, tired: 1.3, fouls: 1.45, cards: 1.35 },
];

/* ================================================================== */
/* Estado interno                                                      */
/* ================================================================== */

type OnField = { card: number; role: Position; energy: number; yellow: boolean; out: boolean };

type TState = {
  input: TeamInput;
  formation: Formation;
  posture: number;
  marking: number;
  passing: number;
  /** linha defensiva: 0 recuada, 1 normal, 2 adiantada */
  line: number;
  /** jogo: 0 pelo meio, 1 misto, 2 pelas pontas */
  width: number;
  /** ritmo: 0 cadenciado, 1 normal, 2 acelerado */
  tempo: number;
  field: OnField[];
  bench: number[];
  subsLeft: number;
  form: number[];
  boost: number;
  stats: TeamStats;
  goals: Map<number, number>;
  assists: Map<number, number>;
  shotsOn: Map<number, number>;
  played: Set<number>;
  cards: Map<number, "y" | "r">;
  conceded: number;
  aiSubs: number;
};

const STAT_FALLBACK = 0.55;

function stat(card: BaseCard, label: string): number {
  const s = card.stats.find((x) => x.label === label);
  return s ? s.value : card.overall * STAT_FALLBACK;
}

/** Nota de goleiro (para jogador de linha no gol, cai bastante via fit). */
function keeperValue(card: BaseCard): number {
  if (card.position !== "GOL") return card.overall * 0.6;
  return 0.35 * stat(card, "REF") + 0.25 * stat(card, "POS") + 0.2 * stat(card, "MÃO") + 0.1 * stat(card, "SAÍ") + 0.1 * stat(card, "PÉS");
}

/* ------------------------------------------------------------------ */
/* Força por setor                                                     */
/* ------------------------------------------------------------------ */

type Contrib = { w: number; f: (c: BaseCard) => number };
const v = (c: BaseCard, parts: [string, number][]) => parts.reduce((s, [l, w]) => s + stat(c, l) * w, 0);

const DEF_ROLE: Partial<Record<Position, Contrib>> = {
  ZAG: { w: 1, f: (c) => v(c, [["DEF", 0.5], ["FÍS", 0.3], ["VEL", 0.2]]) },
  LD: { w: 0.8, f: (c) => v(c, [["DEF", 0.45], ["VEL", 0.3], ["FÍS", 0.25]]) },
  LE: { w: 0.8, f: (c) => v(c, [["DEF", 0.45], ["VEL", 0.3], ["FÍS", 0.25]]) },
  VOL: { w: 0.6, f: (c) => v(c, [["DEF", 0.6], ["FÍS", 0.4]]) },
  MC: { w: 0.2, f: (c) => v(c, [["DEF", 0.6], ["FÍS", 0.4]]) },
};

function midRole(passing: number): Partial<Record<Position, Contrib>> {
  // toque curto valoriza passe e drible; ligação direta, físico e velocidade
  const pas = passing === 0 ? 0.5 : passing === 2 ? 0.32 : 0.42;
  const fis = passing === 2 ? 0.25 : 0.12;
  return {
    VOL: { w: 1, f: (c) => v(c, [["PAS", pas], ["DEF", 0.3], ["FÍS", 1 - pas - 0.3]]) },
    MC: { w: 1, f: (c) => v(c, [["PAS", pas], ["DRI", 0.88 - pas - fis], ["VEL", fis + 0.12]]) },
    MEI: { w: 1, f: (c) => v(c, [["PAS", pas], ["DRI", 0.85 - pas], ["FIN", 0.15]]) },
    LD: { w: 0.35, f: (c) => v(c, [["PAS", 0.5], ["VEL", 0.5]]) },
    LE: { w: 0.35, f: (c) => v(c, [["PAS", 0.5], ["VEL", 0.5]]) },
    PD: { w: 0.35, f: (c) => v(c, [["DRI", 0.5], ["PAS", 0.5]]) },
    PE: { w: 0.35, f: (c) => v(c, [["DRI", 0.5], ["PAS", 0.5]]) },
    ATA: { w: 0.15, f: (c) => v(c, [["PAS", 0.5], ["FÍS", 0.5]]) },
  };
}
const MID_ROLES = [midRole(0), midRole(1), midRole(2)];

function attRole(passing: number): Partial<Record<Position, Contrib>> {
  // [FIN, DRI, VEL, FÍS, PAS] — toque curto: drible e passe; ligação direta: velocidade e físico
  const W = [
    { ata: [0.42, 0.3, 0.14, 0.06, 0.08], wing: [0.3, 0.38, 0.17, 0.0, 0.15] },
    { ata: [0.42, 0.22, 0.22, 0.14, 0.0], wing: [0.32, 0.3, 0.28, 0.0, 0.1] },
    { ata: [0.42, 0.1, 0.28, 0.2, 0.0], wing: [0.32, 0.18, 0.4, 0.1, 0.0] },
  ][passing];
  const mix = (w: number[]) => (c: BaseCard) => v(c, [["FIN", w[0]], ["DRI", w[1]], ["VEL", w[2]], ["FÍS", w[3]], ["PAS", w[4]]]);
  return {
    ATA: { w: 1, f: mix(W.ata) },
    PD: { w: 0.9, f: mix(W.wing) },
    PE: { w: 0.9, f: mix(W.wing) },
    MEI: { w: 0.6, f: (c) => v(c, [["FIN", 0.4], ["DRI", 0.4], ["PAS", 0.2]]) },
    MC: { w: 0.2, f: (c) => v(c, [["FIN", 0.5], ["PAS", 0.5]]) },
    LD: { w: 0.2, f: (c) => v(c, [["VEL", 0.6], ["PAS", 0.4]]) },
    LE: { w: 0.2, f: (c) => v(c, [["VEL", 0.6], ["PAS", 0.4]]) },
  };
}
const ATT_ROLES = [attRole(0), attRole(1), attRole(2)];

/** Peso de referência de cada setor (4-4-2 completo) para medir "cobertura". */
function sectorWeight(f: Formation, table: Partial<Record<Position, Contrib>>) {
  return f.slots.reduce((s, sl) => s + (table[sl.role]?.w ?? 0), 0);
}
const REF_DEF = sectorWeight(FORMATIONS[1], DEF_ROLE);
const REF_MID = sectorWeight(FORMATIONS[1], MID_ROLES[1]);
const REF_ATT = sectorWeight(FORMATIONS[1], ATT_ROLES[1]);

function condition(p: OnField) {
  return 0.8 + 0.2 * (p.energy / 100);
}

/**
 * Força do setor = média ponderada dos jogadores em campo (já com encaixe,
 * cansaço, forma do dia e mando) × bônus de cobertura (quantos jogadores a
 * formação coloca naquele setor). Expulso/lesionado sem reposição = buraco.
 */
function sector(t: TState, table: Partial<Record<Position, Contrib>>, ref: number) {
  let sum = 0;
  let wActive = 0;
  let wNominal = 0;
  for (const p of t.field) {
    const c = table[p.role];
    if (!c) continue;
    wNominal += c.w;
    if (p.out) continue;
    const card = t.input.squad[p.card];
    sum += c.w * c.f(card) * fit(card.position, p.role) * condition(p) * t.form[p.card] * t.boost;
    wActive += c.w;
  }
  if (wNominal === 0) return 30;
  const avg = sum / wNominal; // buraco de expulso puxa a média para baixo
  const coverage = Math.min(1.35, Math.max(0.55, wActive / ref));
  return avg * (0.82 + 0.18 * coverage);
}

function keeper(t: TState) {
  const gk = t.field.find((p) => p.role === "GOL" && !p.out) ?? t.field.find((p) => !p.out);
  if (!gk) return { value: 20, card: -1 };
  const card = t.input.squad[gk.card];
  return { value: keeperValue(card) * fit(card.position, "GOL") * (0.9 + 0.1 * (gk.energy / 100)) * t.form[gk.card] * t.boost, card: gk.card };
}

/* ------------------------------------------------------------------ */
/* Ajustes táticos (linha, jogo, ritmo) — encaixe com o elenco          */
/* ------------------------------------------------------------------ */
// Com os três no "normal" (1), nada aqui é usado: o jogo sai idêntico ao de
// antes, sorteio por sorteio (tests/engine-compat.test.ts).

/** Média de uma combinação de atributos dos jogadores em campo nas posições pedidas. */
function avgOf(t: TState, roles: Position[], parts: [string, number][], empty: number) {
  let sum = 0;
  let n = 0;
  for (const p of t.field) {
    if (p.out || !roles.includes(p.role)) continue;
    const c = t.input.squad[p.card];
    sum += v(c, parts) * fit(c.position, p.role) * condition(p);
    n++;
  }
  return n ? sum / n : empty;
}
const WIDE: Position[] = ["PD", "PE", "LD", "LE"];
const CENTRAL: Position[] = ["ATA", "MEI", "MC"];
/** qualidade de quem joga aberto (velocidade, drible, cruzamento/passe) */
const wideQ = (t: TState) => avgOf(t, WIDE, [["VEL", 0.4], ["DRI", 0.3], ["PAS", 0.3]], 30);
/** qualidade de quem joga por dentro (passe, drible, finalização) */
const centralQ = (t: TState) => avgOf(t, CENTRAL, [["PAS", 0.35], ["DRI", 0.3], ["FIN", 0.35]], 30);
/** velocidade da última linha */
const backPace = (t: TState) => avgOf(t, ["ZAG", "LD", "LE"], [["VEL", 1]], 40);
/** velocidade de quem ataca */
const frontPace = (t: TState) => avgOf(t, ["ATA", "PD", "PE"], [["VEL", 1]], 45);
/** fôlego e arrancada do time (para ritmo acelerado) */
const engineQ = (t: TState) => avgOf(t, ["VOL", "MC", "MEI", "PD", "PE", "LD", "LE", "ATA"], [["VEL", 0.5], ["FÍS", 0.5]], 45);
/** toque de bola do meio (para ritmo cadenciado) */
const touchQ = (t: TState) => avgOf(t, ["VOL", "MC", "MEI"], [["PAS", 0.6], ["DRI", 0.4]], 45);

/**
 * Leitura do elenco para a tela de tática: o que cada ajuste pede e o que o
 * time titular tem. Usa as mesmas medidas do motor (sem cansaço).
 */
export function tacticFit(squad: BaseCard[], lineup: Lineup) {
  const f = FORMATIONS[lineup.formation];
  const field: OnField[] = f.slots.map((sl, i) => ({ card: lineup.xi[i], role: sl.role, energy: 100, yellow: false, out: false }));
  const t = { input: { squad }, field } as unknown as TState;
  const w = wideQ(t);
  const c = centralQ(t);
  const back = backPace(t);
  const eng = engineQ(t);
  const touch = touchQ(t);
  const width = w - c > 3 ? 2 : c - w > 3 ? 0 : 1;
  const line = back >= 62 ? 2 : back <= 52 ? 0 : 1;
  const tempo = eng - 55 >= touch - 56 ? (eng >= 57 ? 2 : 1) : touch >= 58 ? 0 : 1;
  return { width, line, tempo, wide: w, central: c, back, engine: eng, touch };
}

/** Multiplicador do ataque pelo "jogo" escolhido: só rende se o elenco encaixa. */
function widthMul(t: TState) {
  if (t.width === 1) return 1;
  const w = wideQ(t);
  const c = centralQ(t);
  return t.width === 2 ? clamp(1.01 + (w - c) / 70, 0.86, 1.14) : clamp(1.0 + (c - w) / 70, 0.86, 1.14);
}

/** Ritmo: frequência de ataques, qualidade da finalização, posse e cansaço. */
function tempoFx(t: TState) {
  if (t.tempo === 2) {
    // acelerado: mais ataques para quem tem arrancada e fôlego; time lento só se cansa
    const e = engineQ(t);
    return { freq: clamp(1.06 + (e - 55) / 40, 0.84, 1.32), quality: 0.99, poss: -0.01, tired: 1.05 };
  }
  if (t.tempo === 0) {
    // cadenciado: troca passes até achar a melhor chance — só se o meio souber tocar
    const k = touchQ(t);
    return { freq: 0.93, quality: clamp(1 + (k - 56) / 180, 0.92, 1.1), poss: clamp(0.005 + (k - 56) / 500, -0.02, 0.05), tired: 0.9 };
  }
  return { freq: 1, quality: 1, poss: 0, tired: 1 };
}

/* ------------------------------------------------------------------ */
/* Sorteios ponderados                                                 */
/* ------------------------------------------------------------------ */

const SHOOT_W: Record<Position, number> = { ATA: 3, PD: 2, PE: 2, MEI: 1.6, MC: 0.8, VOL: 0.4, LD: 0.35, LE: 0.35, ZAG: 0.3, GOL: 0 };
const HEAD_W: Record<Position, number> = { ATA: 3, ZAG: 2, PD: 0.8, PE: 0.8, VOL: 1, MC: 0.6, MEI: 0.5, LD: 0.4, LE: 0.4, GOL: 0 };

function weighted<T>(r: () => number, items: T[], weight: (x: T) => number): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return null;
  let x = r() * total;
  for (const it of items) {
    x -= Math.max(0, weight(it));
    if (x <= 0) return it;
  }
  return items[items.length - 1];
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/* ================================================================== */
/* Simulação                                                           */
/* ================================================================== */

function initTeam(input: TeamInput, r: () => number, boost: number): TState {
  const formation = FORMATIONS[input.lineup.formation];
  const field: OnField[] = formation.slots.map((s, i) => ({ card: input.lineup.xi[i], role: s.role, energy: 100, yellow: false, out: false }));
  const bench = input.squad.map((_, i) => i).filter((i) => !input.lineup.xi.includes(i));
  return {
    input,
    formation,
    posture: input.lineup.posture,
    marking: input.lineup.marking,
    passing: input.lineup.passing,
    line: input.lineup.line ?? 1,
    width: input.lineup.width ?? 1,
    tempo: input.lineup.tempo ?? 1,
    field,
    bench,
    subsLeft: TUNING.maxSubs,
    // "dia" de cada jogador: entre 0,94 e 1,06
    form: input.squad.map(() => 0.94 + r() * 0.12),
    boost,
    stats: { possession: 0, shots: 0, onTarget: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, saves: 0, subs: 0 },
    goals: new Map(),
    assists: new Map(),
    shotsOn: new Map(),
    played: new Set(field.map((f) => f.card)),
    cards: new Map(),
    conceded: 0,
    aiSubs: 0,
  };
}

const inc = (m: Map<number, number>, k: number, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

export function simulate(input: MatchInput): MatchResult {
  const r = rng(input.seed);
  const tr = rng((input.seed ^ 0x9e3779b9) >>> 0); // só para o texto
  const teams: [TState, TState] = [
    initTeam(input.home, r, input.neutral ? 1 : TUNING.homeBoost),
    initTeam(input.away, r, 1),
  ];
  const changes = [...(input.changes ?? [])].sort((a, b) => a.minute - b.minute);
  const events: MatchEvent[] = [];
  const score: [number, number] = [0, 0];

  const extra1 = 1 + Math.floor(r() * 3);
  const extra2 = 2 + Math.floor(r() * 4);
  const secondHalfTick = 45 + extra1 + 1;
  const length = 90 + extra1 + extra2;

  let tick = 0;
  const clock = () => {
    if (tick <= 45 + extra1) return tick <= 45 ? { minute: tick } : { minute: 45, extra: tick - 45 };
    const m = tick - extra1;
    return m <= 90 ? { minute: m } : { minute: 90, extra: m - 90 };
  };
  const name = (t: 0 | 1, card: number) => teams[t].input.squad[card]?.name ?? "?";
  const push = (type: EventType, team?: 0 | 1, player?: number, other?: number) => {
    const c = clock();
    const text = narrate(tr, {
      type,
      team: team !== undefined ? teams[team].input.short : undefined,
      teamName: team !== undefined ? teams[team].input.name : undefined,
      player: team !== undefined && player !== undefined ? name(team, player) : undefined,
      other: team !== undefined && other !== undefined ? name(type === "save" || type === "penalty_miss" ? ((1 - team) as 0 | 1) : team, other) : undefined,
      home: teams[0].input.name,
      away: teams[1].input.name,
      score,
      posture: team !== undefined ? teams[team].posture : undefined,
      secondHalf: tick >= secondHalfTick,
    });
    events.push({ ...c, tick, type, team, player, other, text, score: [score[0], score[1]] });
  };

  /* ---------------- mudanças (técnico) ---------------- */

  function substitute(t: 0 | 1, outCard: number, inCard: number, reason: "tactic" | "injury"): boolean {
    const st = teams[t];
    if (st.subsLeft <= 0 || !st.bench.includes(inCard)) return false;
    const slot = st.field.find((p) => p.card === outCard && !p.out);
    if (!slot) return false;
    st.bench = st.bench.filter((b) => b !== inCard);
    st.subsLeft--;
    st.stats.subs++;
    st.played.add(inCard);
    slot.card = inCard;
    slot.energy = 100;
    slot.yellow = false;
    push("sub", t, inCard, outCard);
    if (reason === "injury") return true;
    return true;
  }

  function applyChanges() {
    while (changes.length && changes[0].minute <= tick) {
      const ch = changes.shift()!;
      const st = teams[ch.team];
      if (ch.kind === "tactic") {
        if (ch.posture !== undefined) st.posture = clamp(ch.posture, 0, 4);
        if (ch.marking !== undefined) st.marking = clamp(ch.marking, 0, 2);
        if (ch.passing !== undefined) st.passing = clamp(ch.passing, 0, 2);
        if (ch.line !== undefined) st.line = clamp(ch.line, 0, 2);
        if (ch.width !== undefined) st.width = clamp(ch.width, 0, 2);
        if (ch.tempo !== undefined) st.tempo = clamp(ch.tempo, 0, 2);
        push("tactic", ch.team);
      } else {
        substitute(ch.team, ch.out, ch.in, "tactic");
      }
    }
  }

  /** Melhor reserva para uma vaga (prefere quem joga na posição). */
  function bestBench(st: TState, role: Position): number | null {
    let best: number | null = null;
    let bestV = -1;
    for (const b of st.bench) {
      const c = st.input.squad[b];
      const val = c.overall * fit(c.position, role);
      if (val > bestV) {
        bestV = val;
        best = b;
      }
    }
    return best;
  }

  function aiTurn(t: 0 | 1) {
    const st = teams[t];
    if (!st.input.ai) return;
    const minute = clock().minute;
    // substituições de cansaço a partir dos 55'
    if (minute >= 55 && st.subsLeft > 0 && st.aiSubs < 3 && st.bench.length) {
      const tired = st.field
        .filter((p) => !p.out && p.role !== "GOL" && p.energy < 76)
        .sort((a, b) => a.energy - b.energy)[0];
      if (tired && r() < 0.3) {
        const b = bestBench(st, tired.role);
        if (b !== null) {
          const inC = st.input.squad[b];
          const outC = st.input.squad[tired.card];
          // só troca se o reserva render pelo menos parecido
          if (inC.overall * fit(inC.position, tired.role) >= outC.overall * fit(outC.position, tired.role) * condition(tired) - 2) {
            st.aiSubs++;
            substitute(t, tired.card, b, "tactic");
          }
        }
      }
    }
    // postura conforme o placar
    const diff = score[t] - score[1 - t];
    if (minute === 70 && diff < 0 && st.posture < 4) {
      st.posture++;
      push("tactic", t);
    } else if (minute === 80 && diff > 0 && st.posture > 1) {
      st.posture--;
      push("tactic", t);
    }
  }

  function sendOff(t: 0 | 1, p: OnField) {
    const st = teams[t];
    p.out = true;
    st.stats.reds++;
    st.cards.set(p.card, "r");
    push("red", t, p.card);
    // goleiro expulso: entra o reserva de gol (se houver) no lugar de alguém de linha
    if (p.role === "GOL" && st.subsLeft > 0) {
      const gk = st.bench.find((b) => st.input.squad[b].position === "GOL");
      const victim = st.field.filter((x) => !x.out && x.role !== "GOL").sort((a, b) => a.energy - b.energy)[0];
      if (gk !== undefined && victim) {
        victim.role = "GOL";
        substitute(t, victim.card, gk, "tactic");
        p.role = "ZAG"; // a vaga de linha fica vazia
      }
    }
  }

  /* ---------------- um lance de ataque ---------------- */

  function shot(t: 0 | 1, header: boolean) {
    const A = teams[t];
    const D = teams[1 - t];
    // jogo pelas pontas: parte das finalizações vira cabeçada depois de cruzamento
    if (!header && A.width === 2 && r() < 0.22) header = true;
    const shooters = A.field.filter((p) => !p.out && p.role !== "GOL");
    const sh = weighted(r, shooters, (p) => (header ? HEAD_W[p.role] * stat(A.input.squad[p.card], "FÍS") : SHOOT_W[p.role] * stat(A.input.squad[p.card], "FIN")) / 50);
    if (!sh) return;
    const card = A.input.squad[sh.card];
    const q =
      (header
        ? 0.5 * stat(card, "FIN") + 0.5 * stat(card, "FÍS")
        : 0.7 * stat(card, "FIN") + 0.3 * stat(card, A.passing === 2 ? "VEL" : "DRI")) *
      fit(card.position, sh.role) *
      condition(sh) *
      A.form[sh.card] *
      A.boost *
      (A.tempo === 1 ? 1 : tempoFx(A).quality);
    A.stats.shots++;

    const defense = sector(D, DEF_ROLE, REF_DEF) * MARKING[D.marking].def;
    if (r() < TUNING.blockChance * clamp(defense / Math.max(20, q), 0.6, 1.6)) {
      push("block", t, sh.card);
      if (r() < 0.45) {
        A.stats.corners++;
        corner(t);
      }
      return;
    }
    const direct = A.passing === 0 ? 0.015 : 0;
    let aim = TUNING.onTargetBase + (q - 50) / TUNING.onTargetSlope + direct - (header ? 0.05 : 0);
    if (A.tempo === 2) aim -= 0.01; // pressa: chuta mais, acerta menos
    const onTarget = r() < clamp(aim, 0.12, 0.72);
    if (!onTarget) {
      push(r() < 0.09 ? "post" : "miss", t, sh.card);
      return;
    }
    A.stats.onTarget++;
    inc(A.shotsOn, sh.card);
    const gk = keeper(D);
    const pGoal = clamp(TUNING.goalBase * Math.pow(q / Math.max(15, gk.value), TUNING.goalExp), 0.07, 0.68);
    if (r() < pGoal) {
      score[t]++;
      D.conceded++;
      inc(A.goals, sh.card);
      const assistant =
        r() < 0.72
          ? weighted(r, A.field.filter((p) => !p.out && p.card !== sh.card && p.role !== "GOL"), (p) => stat(A.input.squad[p.card], "PAS"))
          : null;
      if (assistant) inc(A.assists, assistant.card);
      push("goal", t, sh.card, assistant?.card);
    } else {
      D.stats.saves++;
      push("save", t, sh.card, gk.card >= 0 ? gk.card : undefined);
      if (r() < 0.3) {
        A.stats.corners++;
        corner(t);
      }
    }
  }

  function corner(t: 0 | 1) {
    push("corner", t);
    if (r() < TUNING.cornerHeader) shot(t, true);
  }

  function penalty(t: 0 | 1) {
    const A = teams[t];
    const D = teams[1 - t];
    let taker = A.field.find((p) => p.card === A.input.lineup.penalty && !p.out);
    if (!taker) taker = weighted(r, A.field.filter((p) => !p.out && p.role !== "GOL"), (p) => stat(A.input.squad[p.card], "FIN")) ?? undefined;
    if (!taker) return;
    const card = A.input.squad[taker.card];
    const gk = keeper(D);
    A.stats.shots++;
    const p = clamp(TUNING.penaltyConv * Math.pow(stat(card, "FIN") / Math.max(30, gk.value), 0.35), 0.55, 0.9);
    if (r() < p) {
      A.stats.onTarget++;
      score[t]++;
      D.conceded++;
      inc(A.goals, taker.card);
      push("penalty_goal", t, taker.card);
    } else {
      if (r() < 0.6) {
        A.stats.onTarget++;
        D.stats.saves++;
      }
      push("penalty_miss", t, taker.card, gk.card >= 0 ? gk.card : undefined);
    }
  }

  function foul(t: 0 | 1) {
    // falta cometida pelo time t
    const st = teams[t];
    const mk = MARKING[st.marking];
    st.stats.fouls++;
    const culprit = weighted(r, st.field.filter((p) => !p.out && p.role !== "GOL"), (p) => (p.role === "ZAG" || p.role === "VOL" ? 2 : 1));
    if (!culprit) return;
    if (r() < TUNING.redPerFoul * mk.cards) return sendOff(t, culprit);
    if (r() < TUNING.yellowPerFoul * mk.cards * (culprit.yellow ? 0.45 : 1)) {
      st.stats.yellows++;
      if (culprit.yellow) {
        st.stats.yellows--; // o 2º amarelo vira vermelho
        return sendOff(t, culprit);
      }
      culprit.yellow = true;
      st.cards.set(culprit.card, "y");
      push("yellow", t, culprit.card);
    }
  }

  /* ---------------- relógio ---------------- */

  push("kickoff");
  for (tick = 1; tick <= length; tick++) {
    if (tick === secondHalfTick) push("kickoff");
    applyChanges();

    const H = teams[0];
    const A = teams[1];
    const midH = sector(H, MID_ROLES[H.passing], REF_MID);
    const midA = sector(A, MID_ROLES[A.passing], REF_MID);
    const e = TUNING.possessionExp;
    let pH = Math.pow(midH, e) / (Math.pow(midH, e) + Math.pow(midA, e));
    const passShift = (p: number) => (p === 0 ? 0.03 : p === 2 ? -0.03 : 0);
    pH +=
      POSTURE[H.posture].poss - POSTURE[A.posture].poss + MARKING[H.marking].poss - MARKING[A.marking].poss + passShift(H.passing) - passShift(A.passing);
    if (H.line !== 1 || A.line !== 1 || H.tempo !== 1 || A.tempo !== 1) {
      const lineShift = (x: TState) => (x.line === 2 ? 0.02 : x.line === 0 ? -0.025 : 0);
      pH += lineShift(H) - lineShift(A) + tempoFx(H).poss - tempoFx(A).poss;
    }
    pH = clamp(pH, 0.22, 0.78);

    const t: 0 | 1 = r() < pH ? 0 : 1;
    const T = teams[t];
    const D = teams[1 - t];
    T.stats.possession++;

    let freq = TUNING.attackChance * POSTURE[T.posture].freq;
    if (T.tempo !== 1) freq *= tempoFx(T).freq;
    if (D.line === 0) freq *= 1.04; // linha recuada: o rival chega mais, mas encontra a área fechada
    // pressão alta: rival perde a bola antes — melhor ainda com zaga rápida para cobrir o espaço
    else if (D.line === 2) freq *= clamp(0.98 - (engineQ(D) - 52) / 250 - (backPace(D) - 58) / 220, 0.84, 1.03);
    if (r() < freq) {
      let att = sector(T, ATT_ROLES[T.passing], REF_ATT) * POSTURE[T.posture].att;
      if (T.width !== 1) att *= widthMul(T);
      let def = sector(D, DEF_ROLE, REF_DEF) * POSTURE[D.posture].def * MARKING[D.marking].def;
      // recuada: sem espaço nas costas, atacante rápido rende menos (zaga lenta agradece)
      if (D.line === 0) def *= clamp(1.06 + (frontPace(T) - backPace(D)) / 100, 1.02, 1.22);
      else if (D.line === 2) def *= 1.02; // pressão alta rouba bolas antes da área
      const danger = att / Math.max(20, def);
      const direct = T.passing === 2 ? 1.12 : T.passing === 0 ? 0.97 : 1;
      if (r() < clamp(TUNING.shotBase * Math.pow(danger, TUNING.shotExp) * direct, 0.06, 0.9)) {
        shot(t, false);
      } else if (r() < TUNING.penaltyChance * clamp(danger, 0.6, 1.6) * MARKING[D.marking].fouls) {
        D.stats.fouls++;
        penalty(t);
      } else if (r() < TUNING.cornerChance * (T.width === 2 ? 1.3 : 1)) {
        T.stats.corners++;
        corner(t);
      }
    }

    // contra-ataque: quem se lança ao ataque deixa espaço atrás
    const D2 = teams[1 - t];
    let exposure = [0, 0.2, 0.5, 1.2, 2.2][T.posture] * (T.passing === 0 ? 0.85 : 1);
    // linha adiantada deixa espaço nas costas; recuada quase não dá contra-ataque
    if (T.line === 2) exposure = exposure * 1.6 + 0.6;
    else if (T.line === 0) exposure *= 0.5;
    if (r() < TUNING.counterBase * exposure) {
      const sharp = 1 + 0.15 * (2 - D2.posture); // times recuados contra-atacam melhor
      const att = sector(D2, ATT_ROLES[2], REF_ATT) * sharp;
      let def = sector(T, DEF_ROLE, REF_DEF) * POSTURE[T.posture].def;
      // linha alta só se segura com zagueiros rápidos contra atacantes rápidos
      if (T.line === 2) def *= Math.pow(clamp(backPace(T) / frontPace(D2), 0.6, 1.25), 1.6);
      if (r() < clamp(0.55 * Math.pow(att / Math.max(20, def), TUNING.shotExp), 0.1, 0.85)) shot((1 - t) as 0 | 1, false);
    }

    // faltas fora da área (quem defende comete mais)
    for (const side of [0, 1] as const) {
      const st = teams[side];
      const pressure = side === t ? 0.55 : 1.45;
      if (r() < TUNING.foulChance * MARKING[st.marking].fouls * pressure * 0.5) foul(side);
    }

    // lesão
    for (const side of [0, 1] as const) {
      if (r() < TUNING.injuryChance) {
        const st = teams[side];
        const victim = weighted(r, st.field.filter((p) => !p.out), () => 1);
        if (victim) {
          push("injury", side, victim.card);
          const b = bestBench(st, victim.role);
          if (b !== null && st.subsLeft > 0) substitute(side, victim.card, b, "injury");
          else victim.out = true;
        }
      }
    }

    // cansaço
    for (const st of teams) {
      let k = POSTURE[st.posture].tired * MARKING[st.marking].tired;
      if (st.tempo !== 1) k *= tempoFx(st).tired;
      for (const p of st.field) {
        if (p.out) continue;
        const c = st.input.squad[p.card];
        if (p.role === "GOL") {
          p.energy = Math.max(0, p.energy - TUNING.gkDrain);
          continue;
        }
        const age = c.age >= 31 ? 1.25 : c.age <= 21 ? 0.9 : 1;
        const body = 1.2 - stat(c, "FÍS") / 250;
        p.energy = Math.max(0, p.energy - TUNING.drain * k * age * body);
      }
    }

    aiTurn(0);
    aiTurn(1);

    if (tick === 45 + extra1) push("halftime");
  }
  tick = length;
  push("fulltime");

  /* ---------------- notas ---------------- */

  const ratings: [Record<number, number>, Record<number, number>] = [{}, {}];
  for (const side of [0, 1] as const) {
    const st = teams[side];
    const res = Math.sign(score[side] - score[1 - side]);
    for (const card of st.played) {
      const c = st.input.squad[card];
      const isGk = st.field.some((p) => p.card === card && p.role === "GOL") || (c.position === "GOL" && st.input.lineup.xi[0] === card);
      const defensive = c.position === "GOL" || c.position === "ZAG" || c.position === "LD" || c.position === "LE";
      let n = 6 + res * 0.3;
      n += (st.goals.get(card) ?? 0) * 1.1 + (st.assists.get(card) ?? 0) * 0.6 + (st.shotsOn.get(card) ?? 0) * 0.15;
      if (isGk) n += st.stats.saves * 0.3 - st.conceded * 0.45;
      else if (defensive) n -= st.conceded * 0.25;
      if (defensive && st.conceded === 0) n += 0.5;
      const card2 = st.cards.get(card);
      if (card2 === "y") n -= 0.3;
      if (card2 === "r") n -= 1.5;
      n += (tr() - 0.5) * 0.8;
      ratings[side][card] = Math.round(clamp(n, 3, 10) * 10) / 10;
    }
  }

  const total = teams[0].stats.possession + teams[1].stats.possession || 1;
  teams[0].stats.possession = Math.round((teams[0].stats.possession / total) * 100);
  teams[1].stats.possession = 100 - teams[0].stats.possession;

  return {
    version: ENGINE_VERSION,
    score: [score[0], score[1]],
    events,
    stats: [teams[0].stats, teams[1].stats],
    ratings,
    length,
    secondHalfTick,
  };
}
