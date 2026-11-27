/**
 * Prancheta Temporadas — PROTÓTIPO da carreira (tudo no aparelho).
 *
 * Um grupo de 8 clubes reais em turno e returno (14 rodadas), simulado com o
 * motor do Prancheta. Os elencos são gerados (na versão completa vêm do pacote
 * de dados com os jogadores reais). Nada vai para o banco.
 */
import { hash32 } from "@/lib/cards/generate";
import { botTeam, type BotTeam } from "@/lib/league/bots";
import { doubleRoundRobin, type Fixture } from "@/lib/league/schedule";
import { simulate, type MatchResult } from "@/lib/sim/engine";
import { START_CLUBS, BIG_CLUBS, tpClub, type TpClub } from "./clubs";

export const GROUP_SIZE = 8;
export const ROUNDS = (GROUP_SIZE - 1) * 2;

export type Msg = { id: string; round: number; kind: "board" | "online" | "offer" | "news"; from: string; title: string; body: string; read?: boolean; offer?: string };

export type Career = {
  v: 1;
  seed: number;
  coach: string;
  club: string;
  /** os 8 clubes do grupo (o seu é o índice 0) */
  group: string[];
  /** rodadas jogadas */
  round: number;
  /** placares por rodada, na ordem das partidas da rodada */
  results: [number, number][][];
  posture: number;
  rep: number;
  inbox: Msg[];
  /** propostas recusadas/aceitas */
  offers: string[];
};

export const PROTO_KEY = "prancheta:tp:proto:v1";

export function newCareer(coach: string, club: string, seed = Date.now() % 1_000_000): Career {
  const others = START_CLUBS.filter((c) => c.slug !== club);
  // 7 adversários sorteados pela semente
  const pool = [...others];
  let s = seed;
  const pick: string[] = [];
  while (pick.length < GROUP_SIZE - 1) {
    s = hash32(`grupo:${s}`);
    pick.push(pool.splice(s % pool.length, 1)[0].slug);
  }
  const me = tpClub(club);
  return {
    v: 1,
    seed,
    coach: coach.trim() || "Técnico",
    club,
    group: [club, ...pick],
    round: 0,
    results: [],
    posture: 2,
    rep: 12,
    offers: [],
    inbox: [
      {
        id: "board-1",
        round: 0,
        kind: "board",
        from: club,
        title: `Bem-vindo ao ${me.name}!`,
        body: `A diretoria confia em você. Objetivo da temporada: terminar entre os 4 primeiros do grupo e brigar pelo acesso à Série C.`,
      },
      {
        id: "online-1",
        round: 0,
        kind: "online",
        from: "online",
        title: "Prancheta Online: técnicos de verdade",
        body: "Aqui você enfrenta a CPU. No Prancheta Online, o adversário é outra pessoa mexendo no time ao vivo — com leilão de cartas, copas todo dia e ranking. Mesma conta, grátis.",
      },
    ],
  };
}

export const fixtures: Fixture[][] = doubleRoundRobin(GROUP_SIZE);

const teamCache = new Map<string, BotTeam>();

/** Elenco gerado de um clube real (força pelo nível do clube). */
export function teamOf(c: Career, slot: number): BotTeam & { club: TpClub } {
  const club = tpClub(c.group[slot]);
  const key = `${c.seed}:${club.slug}`;
  let t = teamCache.get(key);
  if (!t) {
    t = botTeam(hash32(`tp:${c.seed}:${club.slug}`) % 900_000, slot, 1 + club.level);
    teamCache.set(key, t);
  }
  return { ...t, name: club.name, tag: club.tag, club };
}

/** Joga (ou rejoga, para ver os lances) uma partida da rodada. */
export function playMatch(c: Career, round: number, index: number, posture = c.posture): MatchResult {
  const f = fixtures[round][index];
  const side = (slot: number) => {
    const t = teamOf(c, slot);
    const lineup = slot === 0 ? { ...t.lineup, posture } : t.lineup;
    return { name: t.name, short: t.tag, squad: t.squad, lineup, ai: true };
  };
  return simulate({ seed: hash32(`tp:${c.seed}:r${round}:${index}`), home: side(f.home), away: side(f.away) });
}

export type RoundOutcome = { career: Career; mine: { index: number; result: MatchResult; home: boolean } | null };

/** Avança uma rodada: simula os 4 jogos, atualiza reputação e caixa de entrada. */
export function playRound(c: Career): RoundOutcome {
  if (c.round >= ROUNDS) return { career: c, mine: null };
  const r = c.round;
  let mine: RoundOutcome["mine"] = null;
  const scores = fixtures[r].map((f, i) => {
    const res = playMatch(c, r, i);
    if (f.home === 0 || f.away === 0) mine = { index: i, result: res, home: f.home === 0 };
    return res.score as [number, number];
  });
  const next: Career = { ...c, round: r + 1, results: [...c.results, scores], inbox: [...c.inbox] };
  if (mine) {
    const m = mine as NonNullable<RoundOutcome["mine"]>;
    const [h, a] = m.result.score;
    const gf = m.home ? h : a;
    const ga = m.home ? a : h;
    next.rep = Math.max(0, Math.min(100, c.rep + (gf > ga ? 2 + (gf - ga >= 3 ? 1 : 0) : gf === ga ? 0.5 : -1)));
  }
  // mensagens do caminho
  const table = standings(next);
  const pos = table.findIndex((t) => t.slot === 0) + 1;
  if (next.round === 3) {
    next.inbox.push({
      id: "online-2",
      round: 3,
      kind: "online",
      from: "online",
      title: "Copa da Várzea online começa hoje",
      body: "32 técnicos reais, mata-mata em uma noite e moedas para o campeão. Leve seu estilo de jogo para o Prancheta Online.",
    });
  }
  if (next.round === 6 && pos <= 3 && !next.offers.includes("vila-nova")) {
    const big = BIG_CLUBS[0];
    next.inbox.push({
      id: "offer-1",
      round: 6,
      kind: "offer",
      from: big.slug,
      offer: big.slug,
      title: `Proposta do ${big.name}`,
      body: `O ${big.name} (Série B) gostou do seu trabalho no ${tpClub(c.club).name}: ${pos}º lugar no grupo. Oferece contrato até o fim do ano e verba para reforços.`,
    });
  } else if (next.round === 6) {
    next.inbox.push({
      id: "board-2",
      round: 6,
      kind: "board",
      from: c.club,
      title: "A diretoria quer reação",
      body: `O time está em ${pos}º. A torcida cobra e o objetivo é ficar entre os 4. Ajuste a postura do time para os próximos jogos.`,
    });
  }
  if (next.round === ROUNDS) {
    const champion = pos === 1;
    next.rep = Math.min(100, next.rep + (champion ? 15 : pos <= 4 ? 6 : 0));
    next.inbox.push({
      id: "board-end",
      round: ROUNDS,
      kind: "board",
      from: c.club,
      title: champion ? "Campeões do grupo!" : pos <= 4 ? "Classificados!" : "Temporada encerrada",
      body: champion
        ? "Primeiro lugar e acesso garantido. A cidade inteira está em festa."
        : pos <= 4
          ? `${pos}º lugar: objetivo cumprido. A diretoria quer renovar com você.`
          : `${pos}º lugar: abaixo do objetivo. A diretoria vai conversar com você.`,
    });
  }
  return { career: next, mine };
}

export type Row = { slot: number; slug: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number; form: ("V" | "E" | "D")[] };

export function standings(c: Career): Row[] {
  const rows: Row[] = c.group.map((slug, slot) => ({ slot, slug, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }));
  c.results.forEach((round, r) =>
    round.forEach(([h, a], i) => {
      const f = fixtures[r][i];
      const add = (row: Row, gf: number, ga: number) => {
        row.p++;
        row.gf += gf;
        row.ga += ga;
        const res = gf > ga ? "V" : gf === ga ? "E" : "D";
        if (res === "V") {
          row.w++;
          row.pts += 3;
        } else if (res === "E") {
          row.d++;
          row.pts++;
        } else row.l++;
        row.form = [...row.form, res].slice(-5) as Row["form"];
      };
      add(rows[f.home], h, a);
      add(rows[f.away], a, h);
    }),
  );
  return rows.sort((x, y) => y.pts - x.pts || y.w - x.w || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || x.slot - y.slot);
}

/** Próximo jogo do seu clube (ou null no fim). */
export function nextMatch(c: Career) {
  if (c.round >= ROUNDS) return null;
  const i = fixtures[c.round].findIndex((f) => f.home === 0 || f.away === 0);
  const f = fixtures[c.round][i];
  return { index: i, home: f.home === 0, rival: f.home === 0 ? f.away : f.home };
}

export function repLabel(rep: number) {
  return rep < 15 ? "Desconhecido" : rep < 30 ? "Local" : rep < 50 ? "Regional" : rep < 70 ? "Nacional" : rep < 85 ? "Continental" : "Mundial";
}
