import type { ReactNode } from "react";
import { CARD_TIERS, CUPS, DIVISIONS, TIER_ORDER } from "@/lib/game-config";
import { Art } from "@/components/ui/Art";
import { ART } from "@/lib/art-manifest";
import { GameIcon, type GameIconName } from "@/components/ui/GameIcon";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { TierGem } from "@/components/ui/TierGem";
import { DivisionBadge, TrophyIcon } from "@/components/ui/ToonIcons";
import { MatchShowcase } from "./MatchShowcase";
import { SAMPLE_CARDS } from "./sample-cards";
import { CrestArt } from "@/components/tp/CrestArt";

/* ------------------------------------------------------------------ */
/* Base de layout                                                      */
/* ------------------------------------------------------------------ */

function Section({
  id,
  tone = "plain",
  compact = false,
  children,
}: {
  id?: string;
  tone?: "plain" | "band" | "green" | "pink";
  compact?: boolean;
  children: ReactNode;
}) {
  const tones = {
    plain: "",
    band: "border-y-[3px] border-[var(--ink)] bg-[var(--night-2)]",
    green: "border-y-[3px] border-[var(--ink)] bg-[var(--grass-2)]",
    pink: "border-y-[3px] border-[var(--ink)] bg-[var(--hot)]",
  };
  return (
    <section id={id} className={`scroll-mt-20 px-4 sm:px-6 ${compact ? "py-10 sm:py-14" : "py-16 sm:py-24"} ${tones[tone]}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function SectionTitle({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
      <span className="tag">{kicker}</span>
      <h2 className="t-display mt-4 text-3xl sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-lg leading-relaxed text-white/85">{children}</p>}
    </header>
  );
}

function IconTile({ name }: { name: GameIconName }) {
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--cream)] shadow-[0_3px_0_var(--ink)]">
      <GameIcon name={name} className="h-[52px] w-[52px]" />
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function Perks() {
  const perks: { icon: GameIconName; title: string; text: string }[] = [
    { icon: "gratis", title: "Grátis pra começar", text: "Clube, cartas Base, ligas e copas sem gastar nada." },
    { icon: "celular", title: "Roda no celular", text: "Leve, abre no navegador e gasta pouca internet." },
    { icon: "pvp", title: "Técnicos de verdade", text: "Ligas, copas e ranking contra outras pessoas. Vaga livre fica com a CPU, e a rodada nunca para." },
  ];
  return (
    <Section compact>
      <ul className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {perks.map((p) => (
          <li key={p.title} className="panel flex h-full items-center gap-4 p-4 sm:p-5">
            <IconTile name={p.icon} />
            <div>
              <h3 className="t-heading text-lg">{p.title}</h3>
              <p className="mt-1 leading-snug opacity-75">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function LiveMatch() {
  return (
    <Section id="ao-vivo" tone="band">
      <SectionTitle kicker="Partida ao vivo" title={<>Cada lance na sua <span className="text-[var(--grass)]">tela</span></>}>
        Cada jogo é simulado como uma partida de verdade: elenco, tática, mando de campo e até o cansaço fazem diferença.
      </SectionTitle>
      <MatchShowcase />
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function HowItWorks() {
  const steps: { icon: GameIconName; title: string; text: string }[] = [
    { icon: "clube", title: "Funde seu clube", text: "Escolha nome, escudo e cores, monte o elenco na peneira escolhendo suas cartas Base e entre numa liga na hora." },
    { icon: "tatica", title: "Arme a prancheta", text: "Escale os titulares, escolha o esquema e a tática: postura, linha defensiva, jogo pelo meio ou pelas pontas e ritmo." },
    { icon: "ao-vivo", title: "A rodada acontece", text: "Os jogos têm hora marcada. Acompanhe ao vivo e faça mudanças, ou deixe o time jogar sozinho." },
    { icon: "acesso", title: "Suba de divisão", text: "Vença, evolua suas cartas e suba da Várzea até a Liga das Lendas, liberando copas e prêmios." },
  ];
  return (
    <Section id="como-funciona">
      <SectionTitle kicker="Como funciona" title={<>Quatro passos para o <span className="text-[var(--sun)]">título</span></>} />
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="panel halftone relative flex h-full gap-4 p-4 sm:flex-col sm:gap-0 sm:p-5">
            <IconTile name={s.icon} />
            <span className="t-num absolute right-4 top-3 text-2xl text-[var(--ink)]/15 sm:top-4 sm:text-4xl">0{i + 1}</span>
            <div className="min-w-0 sm:mt-5">
              <h3 className="t-heading pr-10 text-lg sm:pr-0 sm:text-xl">{s.title}</h3>
              <p className="mt-1.5 leading-snug opacity-75 sm:mt-2">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function CardsShowcase() {
  return (
    <Section id="cartas" tone="band">
      <SectionTitle kicker="Sistema de cartas" title={<>Cartas que <span className="text-[var(--sun)]">evoluem</span></>}>
        Cada jogador é uma carta. Jogando, ela ganha experiência, sobe de nível e aumenta o overall. Cada carta tem o seu
        potencial — jovens costumam ir mais longe — e só as melhores promessas chegam ao teto da raridade.
      </SectionTitle>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-6">
        {TIER_ORDER.map((id) => {
          const tier = CARD_TIERS[id];
          const card = SAMPLE_CARDS.find((c) => c.tier === id)!;
          return (
            <li key={id} className="flex flex-col items-center">
              <PlayerCard player={card} size="fluid" className="lg:!text-[15px]" />
              <div className="mt-5 w-full max-w-[220px]">
                <div className="flex items-center justify-center gap-2">
                  <TierGem tier={id} className="h-6 w-6" />
                  <h3 className="t-heading text-lg sm:text-xl">{tier.label}</h3>
                </div>
                <dl className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border-[3px] border-[var(--ink)] bg-[var(--paper)] text-center text-[var(--ink)]">
                  <div className="border-r-[3px] border-[var(--ink)] py-2">
                    <dt className="text-[0.65rem] font-extrabold uppercase tracking-wider opacity-55">Teto OVR</dt>
                    <dd className="t-num text-xl">{tier.maxOverall}</dd>
                  </div>
                  <div className="py-2">
                    <dt className="text-[0.65rem] font-extrabold uppercase tracking-wider opacity-55">Teto nível</dt>
                    <dd className="t-num text-xl">{tier.maxLevel}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-center text-sm leading-snug text-white/70">{tier.howToGet}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function LeaguesAndCups() {
  return (
    <Section id="ligas">
      <SectionTitle kicker="Ligas e copas" title={<>Da várzea às <span className="text-[var(--orange)]">lendas</span></>}>
        Entrou hoje? Tem liga com vaga esperando. Todo clube começa na Várzea e cada acesso libera copas novas e prêmios
        maiores — e vale mais pontos no ranking.
      </SectionTitle>

      <h3 className="t-heading mb-4 text-xl text-[var(--sun)]">Divisões</h3>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {DIVISIONS.map((d, i) => {
          const start = i === 0;
          return (
            <li
              key={d.id}
              className={`relative flex h-full flex-col items-center rounded-2xl border-[3px] border-[var(--ink)] p-4 text-center shadow-[0_5px_0_var(--ink)] ${
                start ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-[var(--paper)] text-[var(--ink)]"
              }`}
            >
              <span className="t-num absolute left-3 top-2.5 text-xs opacity-35">{i + 1}</span>
              <Art
                name={`div-${d.id}`}
                width={384}
                height={432}
                className="h-24 w-[86px] object-contain"
                fallback={<DivisionBadge id={d.id} label={d.short} className="h-16 w-14" />}
              />
              <h4 className="t-heading mt-3 text-base leading-tight">{d.name}</h4>
              <p className="mt-1.5 text-sm leading-snug opacity-70">{d.description}</p>
              {start && <span className="tag mt-auto translate-y-1 bg-[var(--grass)]">Início</span>}
            </li>
          );
        })}
      </ol>

      <h3 className="t-heading mb-4 mt-14 text-xl text-[var(--sun)]">Copas</h3>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CUPS.map((c) => (
          <li key={c.id} className="panel flex h-full flex-col items-center p-4 text-center sm:p-6">
            <div className="flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36">
              <Art
                name={`trophy-${c.id}`}
                width={480}
                height={528}
                className="h-full w-full object-contain"
                fallback={<TrophyIcon className="h-20 w-20 sm:h-24 sm:w-24" color={c.color} />}
              />
            </div>
            <h4 className="t-heading mt-3 text-base leading-tight sm:text-lg">{c.name}</h4>
            <p className="mt-1.5 text-sm opacity-65">{c.when}</p>
          </li>
        ))}
      </ul>

      {ART["icon-rodadas"] ? (
        // com a arte: no celular, imagem em cima e texto embaixo; no computador, lado a lado
        <div className="panel-dark mt-10 flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:gap-6 sm:p-6 sm:text-left">
          <Art name="icon-rodadas" width={278} height={384} className="h-28 w-28 shrink-0 object-contain sm:h-32 sm:w-32" fallback={null} />
          <div className="min-w-0">
            <span className="tag bg-[var(--sky)]">Rodadas</span>
            <p className="mt-2.5 leading-snug text-white/85 sm:text-lg">
              O calendário é do jogo: uma rodada a cada 2 horas, das 8h às 22h, e as copas no horário de cada uma. Se você
              não estiver online, o time entra com a última escalação salva.
            </p>
          </div>
        </div>
      ) : (
        <p className="panel-dark mt-10 flex items-start gap-3 p-4 sm:items-center sm:p-5">
          <span className="tag shrink-0 bg-[var(--sky)]">Rodadas</span>
          <span className="leading-snug text-white/85">
            O calendário é do jogo: uma rodada a cada 2 horas, das 8h às 22h, e as copas no horário de cada uma. Se você não
            estiver online, o time entra com a última escalação salva.
          </span>
        </p>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function Auction() {
  const card = SAMPLE_CARDS[2];
  const bids = [
    { who: "Tubarões da Vila", value: "6.300" },
    { who: "Bola Murcha EC", value: "6.000" },
    { who: "Real Várzea", value: "5.500" },
  ];
  return (
    <Section id="leilao" tone="band">
      <SectionTitle kicker="Leilão" title={<>Arremate seu <span className="text-[var(--orange)]">craque</span></>}>
        A cada 2 horas, 12 cartas — Base boas e raras — vão a leilão para todos os técnicos. Veja o potencial de cada uma,
        use as moedas que o clube ganha jogando e leve o craque que falta. Cada lance novo dá 10 minutos para alguém cobrir.
      </SectionTitle>

      <div className="panel halftone mx-auto grid max-w-4xl items-center gap-8 p-5 sm:p-8 md:grid-cols-[auto_1fr] md:gap-10">
        <div className="mx-auto">
          <PlayerCard player={card} size="lg" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag bg-[var(--red)] text-white">
              <span className="h-2 w-2 rounded-full bg-white" /> Ao vivo
            </span>
            <span className="tag bg-white">Fecha em 07:42</span>
          </div>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.15em] opacity-55">Maior lance</p>
          <p className="mt-1 flex items-center gap-2">
            <GameIcon name="moeda" className="h-10 w-10" />
            <span className="t-num text-4xl sm:text-5xl">6.300</span>
          </p>
          <ol className="mt-5 overflow-hidden rounded-xl border-[3px] border-[var(--ink)]">
            {bids.map((b, i) => (
              <li
                key={b.who}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 font-bold ${
                  i === 0 ? "bg-[var(--sun)]" : "border-t-2 border-[var(--ink)]/15 bg-white"
                }`}
              >
                <span className="truncate">{b.who}</span>
                <span className="t-num shrink-0 text-sm">{b.value}</span>
              </li>
            ))}
          </ol>
          <a href="/entrar" className="btn btn-green mt-6 w-full sm:w-auto">
            Quero dar um lance
          </a>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function ClubLife() {
  const items: { art: string; w: number; h: number; tag: string; title: string; text: string; fallback: ReactNode }[] = [
    {
      art: "icon-ranking",
      w: 238,
      h: 256,
      tag: "Ranking",
      title: "Dispute o topo",
      text: "Cada vitória pontua logo depois do apito final, e quanto mais alta a divisão, mais vale. Ranking geral e da semana.",
      fallback: <TrophyIcon className="h-20 w-20" color="var(--sun)" />,
    },
    {
      art: "facility-estadio",
      w: 600,
      h: 366,
      tag: "Estrutura",
      title: "Do terrão à arena",
      text: "Invista no estádio, na lanchonete e na loja oficial: cada jogo em casa rende moedas para o clube.",
      fallback: <GameIcon name="clube" className="h-20 w-20" />,
    },
    {
      art: "icon-eventos",
      w: 512,
      h: 512,
      tag: "Eventos",
      title: "Missões da semana",
      text: "Marque gols, vença jogos e dispute copas para ganhar moedas grátis toda semana.",
      fallback: <GameIcon name="gratis" className="h-20 w-20" />,
    },
    {
      art: "icon-treino",
      w: 512,
      h: 512,
      tag: "Treino",
      title: "Teste a tática",
      text: "Jogue amistosos de treino contra a CPU quando quiser, no seu ritmo, e acerte o time antes da rodada.",
      fallback: <GameIcon name="tatica" className="h-20 w-20" />,
    },
  ];
  return (
    <Section id="clube">
      <SectionTitle kicker="Além do campo" title={<>Seu clube <span className="text-[var(--grass)]">cresce</span></>}>
        O Prancheta não para entre as rodadas: suba no ranking, faça obras no clube e cumpra missões para juntar moedas.
      </SectionTitle>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.tag} className="panel halftone flex h-full flex-col p-4 sm:p-5">
            <div className="flex h-28 items-center justify-center rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--cream)] p-2">
              <Art name={it.art} width={it.w} height={it.h} className="h-full w-full object-contain" fallback={it.fallback} />
            </div>
            <span className="tag mt-4 self-start">{it.tag}</span>
            <h3 className="t-heading mt-2 text-lg sm:text-xl">{it.title}</h3>
            <p className="mt-1.5 leading-snug opacity-75">{it.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

export function Friends() {
  return (
    <Section id="amigos" tone="pink">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="min-w-0 text-center md:text-left">
          <span className="tag bg-white">Amistosos</span>
          <h2 className="t-display mt-4 text-3xl sm:text-5xl">
            Desafie seus <span className="text-[var(--sun)]">amigos</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white">
            Marque um amistoso, mande o link no grupo e escolham o horário. Os dois times entram em campo com a escalação e
            a tática de cada um — e quem perder ouve a resenha a semana inteira.
          </p>
        </div>

        <div className="panel mx-auto w-full min-w-0 max-w-md p-5 sm:p-6">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.15em] opacity-55">Convite de amistoso</p>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--sky)]">
                <PlayerAvatar look={SAMPLE_CARDS[1].look} className="h-full w-full" />
              </div>
              <strong className="mt-2 text-sm">Você</strong>
            </div>
            <span className="t-display text-3xl text-[var(--orange)]">VS</span>
            <div className="flex flex-col items-center">
              <div className="t-display flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-dashed border-[var(--ink)] bg-[var(--cream)] text-3xl text-[var(--ink)] [text-shadow:none]">
                ?
              </div>
              <strong className="mt-2 text-sm">Seu amigo</strong>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-xl border-[3px] border-[var(--ink)] bg-white p-1.5 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold">prancheta.gg/amistosos?c=RESENHA-7K2Q</span>
            <span className="btn btn-sm shrink-0">Copiar</span>
          </div>
          <p className="mt-3 text-center text-sm font-semibold opacity-60">Sábado, 21h · Estádio dos Tubarões</p>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

/** Divulgação do Prancheta Temporadas (modo carreira com clubes reais). */
export function Temporadas() {
  return (
    <Section id="temporadas" tone="band">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="order-2 min-w-0 text-center md:order-1 md:text-left">
          <span className="tag bg-[var(--sun)]">Novo · modo carreira</span>
          <h2 className="t-display mt-4 text-3xl sm:text-5xl">
            Prancheta <span className="text-[var(--sun)]">Temporadas</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/85">
            Treine sozinho com clubes reais: assuma um time da Série D, ganhe reputação e receba propostas dos grandes. Grátis, no
            navegador, com o mesmo motor de partidas do online.
          </p>
          <a href="/temporadas" className="btn btn-green btn-lg mt-6">
            Conhecer o modo carreira
          </a>
        </div>
        <CrestArt
          art="promo-tp-hero"
          clubs={["aguia-de-maraba", "vila-nova", "flamengo"]}
          className="order-1 overflow-hidden rounded-[24px] border-[3px] border-[var(--ink)] shadow-[0_6px_0_var(--ink)] md:order-2"
        />
      </div>
    </Section>
  );
}
