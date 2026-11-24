/**
 * Mini simulador usado na vitrine da tela inicial.
 *
 * É uma versão simplificada do motor de partidas do jogo, mas segue o mesmo
 * princípio que deixa o jogo leve: a partida inteira sai de uma SEED + dados
 * dos times. Mesma seed + mesmos dados = mesma partida, lance a lance.
 * Assim o servidor só precisa guardar a seed e o placar; qualquer celular
 * consegue "reassistir" o jogo recalculando localmente.
 */

export type Tactic = "retranca" | "equilibrado" | "ofensivo";

export const TACTICS: Record<Tactic, { label: string; attack: number; defense: number }> = {
  retranca: { label: "Retranca", attack: -0.12, defense: 0.18 },
  equilibrado: { label: "Equilibrado", attack: 0, defense: 0 },
  ofensivo: { label: "Pra cima!", attack: 0.2, defense: -0.12 },
};

export type SimTeam = {
  name: string;
  short: string;
  color: string;
  strength: number; // 40..99
  players: string[];
};

export type SimState = {
  minute: number;
  score: [number, number];
  ball: { x: number; y: number };
  possession: 0 | 1;
  feed: { minute: number; text: string; kind: "info" | "goal" | "chance" | "card" }[];
  goalFlash: 0 | 1 | null;
  finished: boolean;
  seed: number;
};

/** PRNG determinístico (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initialState(seed: number): SimState {
  return {
    minute: 0,
    score: [0, 0],
    ball: { x: 50, y: 32 },
    possession: 0,
    feed: [{ minute: 0, text: "Bola rolando! Começa a partida.", kind: "info" }],
    goalFlash: null,
    finished: false,
    seed,
  };
}

const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];

/** Avança um minuto de jogo. `homeTactic` é a tática escolhida pelo jogador. */
export function step(
  s: SimState,
  r: () => number,
  teams: [SimTeam, SimTeam],
  homeTactic: Tactic,
): SimState {
  if (s.finished) return s;
  const minute = s.minute + 1;
  const feed = [...s.feed];
  const score: [number, number] = [s.score[0], s.score[1]];
  let { possession } = s;
  let ball = { ...s.ball };
  let goalFlash: SimState["goalFlash"] = null;

  const tac = TACTICS[homeTactic];
  const atk = (t: 0 | 1) => teams[t].strength / 100 + (t === 0 ? tac.attack : 0);
  const def = (t: 0 | 1) => teams[t].strength / 100 + (t === 0 ? tac.defense : 0);

  const attacker = possession;
  const defender = (1 - attacker) as 0 | 1;
  const dir = attacker === 0 ? 1 : -1;
  const progress = attacker === 0 ? ball.x : 100 - ball.x;
  const name = () => pick(r, teams[attacker].players);

  // Perde a bola?
  const lossChance = 0.22 + (def(defender) - atk(attacker)) * 0.6;
  if (r() < lossChance) {
    possession = defender;
    if (r() < 0.25) {
      feed.push({ minute, text: `${pick(r, teams[defender].players)} rouba a bola no meio-campo.`, kind: "info" });
    }
    if (r() < 0.04) {
      feed.push({ minute, text: `Cartão amarelo para ${name()}! Falta dura.`, kind: "card" });
    }
    ball.y = 10 + r() * 44;
  } else if (progress > 74) {
    // Chance de gol
    const quality = atk(attacker) / (atk(attacker) + def(defender));
    if (r() < 0.5) {
      const shooter = name();
      if (r() < quality * 0.55) {
        score[attacker] += 1;
        goalFlash = attacker;
        feed.push({ minute, text: `GOOOOL! ${shooter} estufa a rede! ${teams[attacker].short} marca!`, kind: "goal" });
        ball = { x: 50, y: 32 };
        possession = defender;
      } else {
        const miss = pick(r, [
          `${shooter} chuta forte... o goleiro espalma!`,
          `${shooter} solta a bomba — por cima do travessão!`,
          `Na trave! ${shooter} quase marcou!`,
          `${shooter} cabeceia e o goleiro segura firme.`,
        ]);
        feed.push({ minute, text: miss, kind: "chance" });
        possession = defender;
        ball = { x: attacker === 0 ? 92 : 8, y: 32 };
      }
    } else {
      ball.x += dir * 4 * r();
      ball.y = 20 + r() * 24;
    }
  } else {
    ball.x += dir * (6 + r() * 14) * (0.7 + atk(attacker));
    ball.y = Math.min(58, Math.max(6, ball.y + (r() - 0.5) * 26));
    if (r() < 0.08) {
      feed.push({ minute, text: `${name()} tabela e avança pela ${ball.y < 32 ? "esquerda" : "direita"}.`, kind: "info" });
    }
  }

  ball.x = Math.min(97, Math.max(3, ball.x));

  if (minute === 45) feed.push({ minute, text: "Fim do primeiro tempo!", kind: "info" });
  const finished = minute >= 90;
  if (finished) {
    const [h, a] = score;
    const verdict = h > a ? `Vitória do ${teams[0].short}!` : h < a ? `Vitória do ${teams[1].short}!` : "Empate!";
    feed.push({ minute, text: `Fim de jogo: ${h} x ${a}. ${verdict}`, kind: "info" });
  }

  return {
    ...s,
    minute,
    score,
    ball,
    possession,
    feed: feed.slice(-6),
    goalFlash,
    finished,
  };
}
