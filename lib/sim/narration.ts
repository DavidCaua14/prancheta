/**
 * Narração das partidas, no estilo dos managers clássicos.
 * Usa um sorteio PRÓPRIO (separado do jogo): trocar uma frase nunca muda
 * o resultado de uma partida.
 */

import type { EventType } from "./engine";

export type NarrationCtx = {
  type: EventType;
  team?: string;
  teamName?: string;
  player?: string;
  other?: string;
  home: string;
  away: string;
  score: [number, number];
  posture?: number;
  /** o que mudou numa troca tática (só os campos alterados) */
  tactic?: TacticNote;
  secondHalf?: boolean;
};

export type TacticNote = { posture?: number; marking?: number; passing?: number; line?: number; width?: number; tempo?: number };

const MARKING_NAMES = ["marcação leve", "marcação normal", "marcação sob pressão"];
const PASSING_NAMES = ["toque curto", "passe misto", "ligação direta"];
const LINE_NAMES = ["linha recuada", "linha normal", "linha adiantada"];
const WIDTH_NAMES = ["jogo pelo meio", "jogo misto", "jogo pelas pontas"];
const TEMPO_NAMES = ["ritmo cadenciado", "ritmo normal", "ritmo acelerado"];

/** "Tudo pra frente, linha adiantada e ritmo acelerado" */
function tacticText(n: TacticNote): string {
  const parts: string[] = [];
  if (n.posture !== undefined) parts.push(POSTURE_NAMES[n.posture]);
  if (n.marking !== undefined) parts.push(MARKING_NAMES[n.marking]);
  if (n.passing !== undefined) parts.push(PASSING_NAMES[n.passing]);
  if (n.line !== undefined) parts.push(LINE_NAMES[n.line]);
  if (n.width !== undefined) parts.push(WIDTH_NAMES[n.width]);
  if (n.tempo !== undefined) parts.push(TEMPO_NAMES[n.tempo]);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

const POSTURE_NAMES = ["Retranca", "Defensiva", "Equilibrada", "Ofensiva", "Tudo pra frente"];

const pick = (r: () => number, list: string[]) => list[Math.floor(r() * list.length)];

export function narrate(r: () => number, c: NarrationCtx): string {
  const p = c.player ?? "";
  const o = c.other ?? "";
  const placar = `${c.home} ${c.score[0]} x ${c.score[1]} ${c.away}`;
  switch (c.type) {
    case "kickoff":
      return c.secondHalf
        ? pick(r, ["Começa o segundo tempo!", "Bola rolando para a etapa final!"])
        : pick(r, ["Bola rolando!", "Apita o árbitro, começa o jogo!", "Rola a bola!"]);
    case "goal":
      return (
        pick(r, [
          `GOOOL! ${p} bate firme e marca para o ${c.team}!`,
          `GOOOOOL! ${p} não perdoa e estufa a rede!`,
          `É GOL! ${p} chuta colocado, sem chance para o goleiro!`,
          `GOL DO ${c.team}! ${p} aparece livre e manda pro fundo!`,
          `GOOOL! Que pintura de ${p}!`,
          `GOL! ${p} de primeira, no canto!`,
        ]) + (o ? ` Assistência de ${o}.` : "")
      );
    case "penalty_goal":
      return pick(r, [
        `Pênalti para o ${c.team}! ${p} cobra... GOOOL! Deslocou o goleiro.`,
        `Pênalti! ${p} bate forte no meio e marca!`,
        `Na marca da cal, ${p} não erra: GOL do ${c.team}!`,
      ]);
    case "penalty_miss":
      return pick(r, [
        `Pênalti para o ${c.team}! ${p} cobra... ${o ? `${o} defende!` : "o goleiro defende!"}`,
        `Pênalti! ${p} bate por cima! Desperdiçou!`,
        `Pênalti para o ${c.team}... ${p} chuta na trave!`,
      ]);
    case "save":
      return pick(r, [
        `${p} finaliza e ${o || "o goleiro"} faz grande defesa!`,
        `Chute de ${p}... ${o || "o goleiro"} espalma!`,
        `${p} cabeceia e ${o || "o goleiro"} segura firme.`,
        `${p} arrisca de longe, ${o || "o goleiro"} pega sem dar rebote.`,
        `Que defesa de ${o || "o goleiro"} no chute de ${p}!`,
      ]);
    case "miss":
      return pick(r, [
        `${p} chuta... pra fora!`,
        `${p} solta a bomba, por cima do travessão!`,
        `${p} tenta de longe, a bola passa raspando.`,
        `${p} pega mal na bola e manda pela linha de fundo.`,
        `Chance perdida! ${p} chuta torto.`,
      ]);
    case "post":
      return pick(r, [`NA TRAVE! ${p} quase marcou!`, `Uhhh! ${p} carimba o travessão!`, `Na trave! A bola de ${p} ainda tira tinta do poste.`]);
    case "block":
      return pick(r, [`${p} chuta, mas a zaga trava!`, `Bloqueio da defesa no chute de ${p}.`, `${p} tenta, a bola explode na marcação.`]);
    case "corner":
      return pick(r, [`Escanteio para o ${c.team}.`, `Bola na área... escanteio para o ${c.team}.`, `${c.team} tem escanteio.`]);
    case "yellow":
      return pick(r, [`Cartão amarelo para ${p} (${c.team}).`, `${p} chega atrasado e leva amarelo.`, `Falta dura de ${p}: amarelo.`]);
    case "red":
      return pick(r, [`CARTÃO VERMELHO! ${p} está expulso! O ${c.team} fica com um a menos.`, `Expulso! ${p} vai mais cedo para o chuveiro.`]);
    case "sub":
      return `Substituição no ${c.team}: sai ${o}, entra ${p}.`;
    case "injury":
      return pick(r, [`${p} sente uma lesão e pede para sair.`, `${p} cai no gramado, sentindo dores.`]);
    case "tactic": {
      const who = c.teamName ?? c.team;
      const n = c.tactic;
      // só a postura (ou mudança antiga sem detalhe): a frase de sempre
      if (!n || (n.posture !== undefined && Object.keys(n).length === 1)) return `${who} muda a postura: ${POSTURE_NAMES[n?.posture ?? c.posture ?? 2]}.`;
      return `${who} muda a tática: ${tacticText(n)}.`;
    }
    case "halftime":
      return `Fim do primeiro tempo: ${placar}.`;
    case "fulltime": {
      const [h, a] = c.score;
      const verdict = h > a ? `Vitória do ${c.home}!` : h < a ? `Vitória do ${c.away}!` : "Empate!";
      return `Fim de jogo: ${placar}. ${verdict}`;
    }
  }
}
