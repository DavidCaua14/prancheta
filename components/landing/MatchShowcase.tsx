/**
 * Vitrine da tela de partida. É só uma ilustração (propaganda): nada aqui é
 * clicável nem se mexe — mostra como o jogo vai ser.
 */

const HOME = { name: "Tubarões da Vila", short: "TUB", color: "var(--sky)" };
const AWAY = { name: "Unidos do Morro", short: "UNI", color: "var(--hot)" };

// Posições (campo 100 × 64) congeladas num ataque do time da casa.
const HOME_PLAYERS: [number, number][] = [
  [7, 32], [24, 12], [22, 28], [22, 40], [24, 54], [44, 20], [42, 44], [58, 32], [70, 14], [74, 46], [80, 30],
];
const AWAY_PLAYERS: [number, number][] = [
  [94, 32], [84, 18], [86, 30], [84, 44], [78, 56], [66, 24], [64, 40], [54, 50], [48, 30], [36, 22], [34, 42],
];
const BALL: [number, number] = [82, 33];

const FEED = [
  { min: "67", text: "GOOOL! Faísca recebe na área e bate cruzado. Tubarões na frente!", kind: "goal" },
  { min: "64", text: "Técnico do TUB muda para “Pra cima!” e coloca Biscoito no jogo.", kind: "coach" },
  { min: "58", text: "Na trave! Canhota arrisca de fora e quase empata de novo.", kind: "chance" },
  { min: "51", text: "Cartão amarelo para Galo, falta dura no meio-campo.", kind: "card" },
  { min: "38", text: "GOOOL! Dr. Canhota cobra falta no ângulo. Empate no Morro!", kind: "goal" },
] as const;

const POINTS = [
  { title: "Narração lance a lance", text: "Igual aos managers clássicos: você lê o jogo acontecer, com gols, chances, cartões e substituições." },
  { title: "Mexa no time durante o jogo", text: "Mude a tática, faça substituições e veja o efeito em campo na hora." },
  { title: "Ou só veja o resultado", text: "A rodada acontece no horário marcado, com ou sem você online. Seu time entra com a última escalação salva." },
];

function Pitch() {
  return (
    <svg viewBox="0 0 100 64" className="pitch block w-full" aria-hidden>
      <g fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.9">
        <rect x="2" y="2" width="96" height="60" rx="1" />
        <line x1="50" y1="2" x2="50" y2="62" />
        <circle cx="50" cy="32" r="8" />
        <rect x="2" y="18" width="13" height="28" />
        <rect x="85" y="18" width="13" height="28" />
        <rect x="2" y="25" width="5" height="14" />
        <rect x="93" y="25" width="5" height="14" />
      </g>
      <rect x="0" y="28" width="2" height="8" fill="#fff" stroke="var(--ink)" strokeWidth="0.4" />
      <rect x="98" y="28" width="2" height="8" fill="#fff" stroke="var(--ink)" strokeWidth="0.4" />
      {/* linha do passe */}
      <path d="M70 14 Q78 20 82 33" fill="none" stroke="var(--sun)" strokeWidth="0.7" strokeDasharray="1.2 1.2" />
      {[...HOME_PLAYERS.map((p, i) => ({ p, team: 0, gk: i === 0 })), ...AWAY_PLAYERS.map((p, i) => ({ p, team: 1, gk: i === 0 }))].map(
        ({ p: [x, y], team, gk }, i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <ellipse cx="0.4" cy="2.3" rx="2.1" ry="0.8" fill="rgba(0,0,0,0.25)" />
            <circle r="2" fill={gk ? "var(--sun)" : team === 0 ? HOME.color : AWAY.color} stroke="var(--ink)" strokeWidth="0.6" />
            <circle cx="-0.6" cy="-0.5" r="0.38" fill="var(--ink)" />
            <circle cx="0.6" cy="-0.5" r="0.38" fill="var(--ink)" />
          </g>
        ),
      )}
      <g transform={`translate(${BALL[0]} ${BALL[1]})`}>
        <circle r="1.2" fill="#fff" stroke="var(--ink)" strokeWidth="0.5" />
        <circle r="0.4" fill="var(--ink)" />
      </g>
    </svg>
  );
}

export function MatchShowcase() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.35fr_1fr]">
      {/* "print" da tela do jogo */}
      <figure className="rounded-[26px] border-[3px] border-[var(--ink)] bg-[#e6dcc3] p-2.5 shadow-[0_6px_0_var(--ink)] sm:p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--ink)] px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white" style={{ background: HOME.color }} />
            <span className="truncate text-sm font-extrabold text-white sm:text-base">
              <span className="sm:hidden">{HOME.short}</span>
              <span className="hidden sm:inline">{HOME.name}</span>
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="t-num whitespace-nowrap text-2xl leading-none text-white sm:text-3xl">
              2<span className="mx-1.5 text-[var(--sun)]">×</span>1
            </span>
            <span className="mt-1 whitespace-nowrap rounded bg-[var(--red)] px-1.5 text-[0.7rem] font-extrabold leading-5 text-white">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-white align-middle" />
              2º tempo · 67&apos;
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-right text-sm font-extrabold text-white sm:text-base">
              <span className="sm:hidden">{AWAY.short}</span>
              <span className="hidden sm:inline">{AWAY.name}</span>
            </span>
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white" style={{ background: AWAY.color }} />
          </div>
        </div>

        <div className="relative mt-2.5 overflow-hidden rounded-2xl border-[3px] border-[var(--ink)]">
          <Pitch />
          <span className="absolute left-2 top-2 rounded-lg border-2 border-[var(--ink)] bg-[var(--paper)] px-2 py-0.5 text-[0.7rem] font-extrabold text-[var(--ink)] sm:left-3 sm:top-3 sm:text-xs">
            TUB · 4-3-3 · Pra cima!
          </span>
        </div>

        <figcaption className="mt-2.5 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)]">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.15em] opacity-50">Narração</p>
          <ol className="mt-1 text-sm leading-snug">
            {FEED.map((e, i) => (
              <li
                key={e.min}
                className={`flex gap-2 border-b border-dashed border-black/10 py-1 last:border-0 ${
                  e.kind === "goal"
                    ? "font-extrabold text-[var(--grass-3)]"
                    : e.kind === "card"
                      ? "font-bold text-[#a86d00]"
                      : e.kind === "coach"
                        ? "font-bold text-[var(--purple)]"
                        : "font-bold"
                } ${i > 2 ? "max-sm:hidden" : ""}`}
              >
                <span className="t-num w-7 shrink-0 text-[var(--hot)]">{e.min}&apos;</span>
                <span className="min-w-0">{e.text}</span>
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>

      <ul className="grid gap-4">
        {POINTS.map((p, i) => (
          <li key={p.title} className="flex gap-4">
            <span className="t-num flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] text-lg text-[var(--ink)] shadow-[0_3px_0_var(--ink)]">
              {i + 1}
            </span>
            <div>
              <h3 className="t-heading text-lg">{p.title}</h3>
              <p className="mt-1 leading-snug text-white/75">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
