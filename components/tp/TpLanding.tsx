/* eslint-disable @next/next/no-img-element -- artes e escudos já otimizados em WebP */
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { ART } from "@/lib/art-manifest";
import { BIG_CLUBS, START_CLUBS } from "@/lib/tp/proto/clubs";
import { CrestArt, TpCrest } from "./CrestArt";

const ONLINE = (slot: string) => `/?ref=tp&slot=${slot}`;

/** Página pública do Prancheta Temporadas (protótipo). */
export function TpLanding() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--night)] text-white">
      <header className="sticky top-0 z-40 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Prancheta" className="flex min-w-0 items-center gap-2">
            <Logo />
            <span className="tag hidden !bg-[var(--sun)] sm:inline-flex">Temporadas</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href={ONLINE("landing")} className="btn btn-sm !bg-[var(--hot)] !text-white">
              <Icon name="bolt" className="h-4 w-4" /> <span className="hidden min-[400px]:inline">Jogar o </span>online
            </a>
            <Link href="/temporadas/jogo" className="btn btn-green btn-sm hidden sm:inline-flex">
              Começar carreira
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-clip">
        {/* hero: escritório do técnico, com escudos reais na parede */}
        <section className="relative">
          <CrestArt art="promo-tp-landing" clubs={["aguia-de-maraba", "vila-nova", "flamengo"]} eager />
          <div className="flex items-center bg-[var(--night)] md:absolute md:inset-0 md:bg-transparent md:bg-gradient-to-r md:from-[rgba(27,16,56,0.95)] md:via-[rgba(27,16,56,0.55)] md:to-transparent">
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
              <div className="max-w-xl">
                <span className="tag !bg-[var(--sun)]">Novo · modo carreira grátis</span>
                <h1 className="t-display mt-3 text-4xl leading-[1.05] sm:text-6xl">
                  Prancheta <span className="text-[var(--sun)]">Temporadas</span>
                </h1>
                <p className="mt-3 text-lg font-semibold text-white/90">
                  Assuma um clube real da Série D, monte a tática, negocie com jogadores e suba degrau por degrau até um gigante do futebol.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/temporadas/jogo" className="btn btn-green btn-lg">
                    <Icon name="play" className="h-5 w-5" /> Começar carreira
                  </Link>
                  <a href="#online" className="btn btn-paper btn-lg">
                    E o online?
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* clubes reais */}
        <section className="border-y-[3px] border-[var(--ink)] bg-[var(--night-2)] px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-6xl text-center">
            <span className="tag">Clubes reais</span>
            <h2 className="t-display mt-3 text-3xl sm:text-4xl">Comece por baixo. Termine no topo.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-white/80">Escolha seu clube na Série D. Vitórias trazem reputação, e reputação traz propostas dos grandes.</p>
            <div className="mx-auto mt-6 grid max-w-4xl grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
              {[...START_CLUBS, ...BIG_CLUBS].slice(0, 24).map((c) => (
                <div key={c.slug} className="flex aspect-square items-center justify-center rounded-xl bg-white/5 p-1.5" title={c.name}>
                  <TpCrest slug={c.slug} className="h-full w-full" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* jornada */}
        <section className="px-4 py-12 sm:px-6">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
            <CrestArt art="promo-tp-hero" clubs={["itabaiana", "crb", "palmeiras"]} className="overflow-hidden rounded-[24px] border-[3px] border-[var(--ink)] shadow-[0_6px_0_var(--ink)]" />
            <div>
              <span className="tag">Sua carreira</span>
              <h2 className="t-display mt-3 text-3xl sm:text-4xl">Do campinho ao estádio lotado</h2>
              <ul className="mt-4 space-y-2 text-white/85">
                {[
                  "Reputação de técnico: cada vitória acima do esperado conta",
                  "Propostas de clubes maiores (e demissão, se a diretoria perder a paciência)",
                  "Tática completa: postura, funções e atributos que fazem diferença",
                  "Mesmo motor de partidas do Prancheta, com narração lance a lance",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-[var(--grass)]" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {[
              { art: "promo-tp-cartao", clubs: ["vila-nova", "sport", "goias"], title: "Propostas na mesa", text: "Clubes maiores de olho no seu trabalho." },
              { art: "promo-tp-proposta", clubs: ["corinthians"], title: "O aperto de mão", text: "Negocie salário, verba e objetivos." },
              { art: "promo-tp-elenco", clubs: ["gama"], title: "Seu elenco", text: "Monte o time e ajuste a tática a cada jogo." },
            ].map((c) => (
              <div key={c.art} className="overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
                <CrestArt art={c.art} clubs={c.clubs} />
                <div className="p-3">
                  <p className="t-heading">{c.title}</p>
                  <p className="text-sm font-semibold opacity-75">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* online */}
        <section id="online" className="scroll-mt-16 border-y-[3px] border-[var(--ink)] bg-[var(--hot)] px-4 py-12 sm:px-6">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
            <div className="order-2 md:order-1">
              <span className="tag bg-white">Prancheta Online</span>
              <h2 className="t-display mt-3 text-3xl sm:text-5xl">Cansou da CPU? Jogue contra gente.</h2>
              <p className="mt-3 text-lg text-white">
                No Prancheta Online, cada rival é um técnico de verdade mexendo no time ao vivo. Leilão de cartas, copas todo dia, ranking e amistosos com amigos. Mesma conta, grátis.
              </p>
              <a href={ONLINE("landing")} className="btn btn-green btn-lg mt-5">
                Jogar o Prancheta Online <Icon name="arrow-right" className="h-5 w-5" />
              </a>
            </div>
            {ART["promo-online-landing"] && (
              <img src={ART["promo-online-landing"]} alt="" className="order-1 w-full rounded-[24px] border-[3px] border-[var(--ink)] shadow-[0_6px_0_var(--ink)] md:order-2" loading="lazy" />
            )}
          </div>
        </section>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-white/50 sm:px-6">
        Protótipo do Prancheta Temporadas. Escudos e nomes pertencem aos respectivos clubes.
      </footer>
    </div>
  );
}
