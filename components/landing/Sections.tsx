import type { ReactNode } from "react";
import { CARD_TIERS, CUPS, DIVISIONS, TIER_ORDER } from "@/lib/game-config";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import {
  ClipboardIcon,
  GavelIcon,
  GiftIcon,
  HandshakeIcon,
  PhoneIcon,
  ShieldIcon,
  TrophyIcon,
  TvIcon,
} from "@/components/ui/ToonIcons";
import { MatchDemo } from "./MatchDemo";
import { SAMPLE_CARDS } from "./sample-cards";

function SectionTitle({ kicker, title, children }: { kicker?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {kicker && <span className="toon-chip bg-[var(--toon-sky)]">{kicker}</span>}
      <h2 className="toon-title mt-3 text-4xl sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-lg font-bold text-white/85">{children}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Ticker() {
  const items = [
    "Rodada 12 da Várzea começa às 20h",
    "Tubarões da Vila 3 x 2 Unidos do Morro",
    "Leilão: carta ESPECIAL saindo por 48.200 moedas",
    "Bola Murcha EC sobe para a Série D!",
    "Copa Nacional: oitavas definidas",
    "Novo técnico? Liga da Várzea tem vaga agora",
  ];
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-b-4 border-[var(--toon-ink)] bg-[var(--toon-sun)] py-2 text-[var(--toon-ink)]" aria-hidden>
      <div className="anim-marquee flex w-max gap-10 whitespace-nowrap font-[family-name:var(--font-toon-display)] text-lg tracking-wide">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            {t}
            <span className="text-[var(--toon-hot)]">⚽</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Perks() {
  const perks = [
    { icon: <GiftIcon className="h-12 w-12" />, title: "Grátis de verdade", text: "Cartas Base, ligas e copas sem gastar nada." },
    { icon: <PhoneIcon className="h-12 w-12" />, title: "No navegador", text: "Leve como um jogo dos anos 90. Abre até no 4G." },
    { icon: <HandshakeIcon className="h-12 w-12" />, title: "Gente de verdade", text: "Todo adversário é outro técnico, não um robô." },
  ];
  return (
    <section className="mx-auto -mt-2 max-w-5xl px-4 pt-12">
      <ul className="grid gap-5 sm:grid-cols-3">
        {perks.map((p) => (
          <li key={p.title} className="toon-box toon-paper flex items-center gap-4 p-4">
            <span className="shrink-0">{p.icon}</span>
            <span>
              <strong className="block font-[family-name:var(--font-toon-display)] text-xl tracking-wide">{p.title}</strong>
              <span className="text-sm font-semibold opacity-80">{p.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function LiveMatch() {
  return (
    <section id="ao-vivo" className="scroll-mt-28 px-4 py-20">
      <SectionTitle kicker="Simulação ao vivo" title={<>Cada lance na sua <span className="text-[var(--toon-grass)]">telinha</span></>}>
        Seu time joga sozinho, igual no manager clássico, mas agora você pode assistir ao vivo e mexer na tática no meio
        do jogo. Testa aí: muda a tática do TUB e vê o que acontece.
      </SectionTitle>
      <MatchDemo />
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function HowItWorks() {
  const steps = [
    { icon: <ShieldIcon className="h-16 w-16" />, title: "Funde seu clube", text: "Escolha nome, escudo e cores. Você ganha um elenco inicial de cartas Base e entra direto numa liga da Várzea.", color: "bg-[var(--toon-sky)]" },
    { icon: <ClipboardIcon className="h-16 w-16" />, title: "Monte a prancheta", text: "Escale os 11, escolha o esquema (4-4-2, 3-5-2...) e o estilo: retranca, toque de bola ou pra cima deles.", color: "bg-[var(--toon-sun)]" },
    { icon: <TvIcon className="h-16 w-16" />, title: "A rodada rola sozinha", text: "Os jogos têm hora marcada. Assista ao vivo e faça substituições, ou feche o app: o jogo acontece de qualquer jeito.", color: "bg-[var(--toon-hot)]" },
    { icon: <TrophyIcon className="h-16 w-16" />, title: "Suba de divisão", text: "Ganhe, evolua suas cartas e suba da Várzea até a Liga das Lendas. Cada degrau abre copas e prêmios novos.", color: "bg-[var(--toon-grass)]" },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-28 border-y-4 border-[var(--toon-ink)] bg-[var(--toon-grass-dark)] px-4 py-20">
      <SectionTitle kicker="Como funciona" title={<>Quatro passos pro <span className="text-[var(--toon-sun)]">timaço</span></>} />
      <ol className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="toon-box toon-paper toon-halftone relative p-5 pt-8">
            <span className="toon-box-sm absolute -left-3 -top-4 flex h-11 w-11 items-center justify-center bg-[var(--toon-ink)] font-[family-name:var(--font-toon-display)] text-2xl text-[var(--toon-sun)]">
              {i + 1}
            </span>
            <div className={`toon-box-sm mb-4 flex h-24 items-center justify-center ${s.color}`}>{s.icon}</div>
            <h3 className="font-[family-name:var(--font-toon-display)] text-2xl tracking-wide">{s.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed opacity-85">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function CardsShowcase() {
  const byTier = TIER_ORDER.map((tier) => ({
    tier: CARD_TIERS[tier],
    card: SAMPLE_CARDS.find((c) => c.tier === tier)!,
  }));
  return (
    <section id="cartas" className="scroll-mt-28 px-4 py-20">
      <SectionTitle kicker="Sistema de cartas" title={<>Do terrão ao <span className="text-[var(--toon-sun)]">estrelato</span></>}>
        Cada jogador é uma cartinha que ganha experiência jogando, sobe de nível e aumenta o overall. Quanto mais rara,
        mais longe ela chega.
      </SectionTitle>
      <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {byTier.map(({ tier, card }) => (
          <li key={tier.id} className={`toon-box card-tier-${tier.id} flex flex-col items-center gap-4 bg-[var(--toon-paper)] p-5 text-[var(--toon-ink)]`}>
            <PlayerCard player={card} />
            <div className="w-full">
              <h3 className="toon-title-sm text-center text-3xl text-[var(--c1)]">{tier.label}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="toon-box-sm bg-white px-2 py-1.5">
                  <dt className="text-[0.65rem] font-black uppercase opacity-60">Overall máx</dt>
                  <dd className="font-[family-name:var(--font-toon-display)] text-2xl">{tier.maxOverall}</dd>
                </div>
                <div className="toon-box-sm bg-white px-2 py-1.5">
                  <dt className="text-[0.65rem] font-black uppercase opacity-60">Nível máx</dt>
                  <dd className="font-[family-name:var(--font-toon-display)] text-2xl">{tier.maxLevel}</dd>
                </div>
              </dl>
              <p className="mt-3 text-center text-sm font-bold opacity-80">{tier.howToGet}</p>
              <p className="mt-1 text-center text-xs font-black uppercase text-[var(--toon-hot)]">
                {tier.squadLimit ? `Até ${tier.squadLimit} por elenco` : "Sem limite no elenco"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function LeaguesAndCups() {
  const ladder = [...DIVISIONS].reverse();
  return (
    <section id="ligas" className="scroll-mt-28 border-y-4 border-[var(--toon-ink)] bg-[var(--toon-night-2)] px-4 py-20">
      <SectionTitle kicker="Ligas & copas" title={<>Suba degrau por <span className="text-[var(--toon-orange)]">degrau</span></>}>
        Entrou hoje? Já tem liga te esperando. Todo clube novo começa na Várzea, e cada acesso libera novas copas,
        prêmios e cartas melhores no leilão.
      </SectionTitle>

      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_1fr]">
        <ol className="flex flex-col gap-3">
          {ladder.map((d, i) => {
            const indent = (ladder.length - 1 - i) * 3;
            const isStart = d.id === "varzea";
            return (
              <li
                key={d.id}
                className={`toon-box-sm flex items-center gap-4 px-4 py-3 ${isStart ? "bg-[var(--toon-sun)]" : "bg-[var(--toon-paper)]"} text-[var(--toon-ink)]`}
                style={{ marginLeft: `${indent}%`, marginRight: `${indent}%` }}
              >
                <span className="toon-box-sm flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--toon-ink)] font-[family-name:var(--font-toon-display)] text-xl text-[var(--toon-sun)]">
                  {d.short}
                </span>
                <span className="min-w-0">
                  <strong className="block font-[family-name:var(--font-toon-display)] text-xl tracking-wide">
                    {d.name} {isStart && <span className="toon-chip ml-1 bg-[var(--toon-grass)] align-middle !text-[0.6rem]">Você começa aqui</span>}
                  </strong>
                  <span className="text-sm font-semibold opacity-80">{d.description}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div>
          <h3 className="toon-title-sm mb-4 text-center text-3xl text-[var(--toon-sun)] lg:text-left">Copas pelo caminho</h3>
          <ul className="grid grid-cols-2 gap-4">
            {CUPS.map((c) => (
              <li key={c.id} className="toon-box toon-paper flex flex-col items-center p-4 text-center">
                <TrophyIcon className="anim-bob h-16 w-16" color={c.color} />
                <strong className="mt-2 font-[family-name:var(--font-toon-display)] text-lg leading-tight tracking-wide">{c.name}</strong>
                <span className="mt-1 text-xs font-bold opacity-70">{c.unlock}</span>
              </li>
            ))}
          </ul>
          <p className="toon-box-sm mt-5 bg-[var(--toon-ink)] p-4 text-sm font-bold text-white/90">
            <span className="text-[var(--toon-sun)]">⏰ Rodadas com hora marcada:</span> o calendário é do jogo, não seu. Se
            você não estiver online, seu time entra com a última escalação salva.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Auction() {
  const card = SAMPLE_CARDS[2];
  const bids = [
    { who: "Tubarões da Vila", value: "31.500" },
    { who: "Bola Murcha EC", value: "29.000" },
    { who: "Real Várzea", value: "26.750" },
  ];
  return (
    <section id="leilao" className="scroll-mt-28 px-4 py-20">
      <SectionTitle kicker="Leilão" title={<>Bateu o <span className="text-[var(--toon-orange)]">martelo!</span></>}>
        Cartas raras vão a leilão para todos os técnicos. Dê seu lance com as moedas que seu clube ganha jogando e leve o
        craque que falta pro seu time.
      </SectionTitle>

      <div className="toon-box toon-paper toon-halftone mx-auto grid max-w-4xl items-center gap-8 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="relative mx-auto">
          <span className="absolute -right-5 -top-14 z-10">
            <GavelIcon className="anim-wiggle h-16 w-16" />
          </span>
          <PlayerCard player={card} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="toon-chip bg-[var(--toon-red)] text-white">
              <span className="anim-blink h-2 w-2 rounded-full bg-white" /> Ao vivo
            </span>
            <span className="toon-chip bg-white">Termina em 02:14:07</span>
          </div>
          <p className="mt-4 text-sm font-black uppercase opacity-60">Maior lance</p>
          <p className="toon-title text-5xl text-[var(--toon-grass)]">31.500 🪙</p>
          <ol className="mt-4 space-y-2">
            {bids.map((b, i) => (
              <li key={b.who} className={`toon-box-sm flex justify-between px-3 py-2 text-sm font-black ${i === 0 ? "bg-[var(--toon-sun)]" : "bg-white"}`}>
                <span>{b.who}</span>
                <span>{b.value}</span>
              </li>
            ))}
          </ol>
          <a href="#comecar" className="toon-btn mt-6 w-full text-lg sm:w-auto">
            Quero dar meu lance
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Friends() {
  return (
    <section id="amigos" className="scroll-mt-28 border-y-4 border-[var(--toon-ink)] bg-[var(--toon-hot)] px-4 py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div className="text-center md:text-left">
          <span className="toon-chip bg-white">Amistosos</span>
          <h2 className="toon-title mt-3 text-4xl sm:text-5xl">
            Chama a <span className="text-[var(--toon-sun)]">resenha</span> pro jogo
          </h2>
          <p className="mt-4 text-lg font-bold text-white">
            Marque um amistoso com os amigos: manda o link no grupo, escolhe o horário e assistam juntos o seu time contra o
            dele. Quem perder paga o churrasco (isso não é com a gente).
          </p>
        </div>

        <div className="toon-box toon-paper p-5">
          <p className="text-center text-xs font-black uppercase tracking-widest opacity-60">Convite de amistoso</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex flex-col items-center">
              <div className="toon-box-sm h-20 w-20 overflow-hidden rounded-full bg-[var(--toon-sky)]">
                <PlayerAvatar look={SAMPLE_CARDS[1].look} className="h-full w-full" />
              </div>
              <strong className="mt-2 text-sm font-black">Você</strong>
            </div>
            <span className="toon-title text-4xl text-[var(--toon-orange)]">VS</span>
            <div className="flex flex-col items-center">
              <div className="toon-box-sm flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--toon-cream)] font-[family-name:var(--font-toon-display)] text-4xl text-[var(--toon-ink)]">
                ?
              </div>
              <strong className="mt-2 text-sm font-black">Seu amigo</strong>
            </div>
          </div>
          <div className="toon-box-sm mt-5 flex items-center justify-between gap-2 bg-white px-3 py-2 font-mono text-sm font-bold">
            <span className="truncate">prancheta.gg/x/RESENHA-7</span>
            <span className="toon-chip shrink-0 bg-[var(--toon-sun)]">Copiar</span>
          </div>
          <p className="mt-3 text-center text-sm font-bold opacity-70">Sábado, 21h · Estádio do Tubarões</p>
        </div>
      </div>
    </section>
  );
}
