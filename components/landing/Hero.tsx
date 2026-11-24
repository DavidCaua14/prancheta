import { Art } from "@/components/ui/Art";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { SAMPLE_CARDS } from "./sample-cards";

/** Explosão de raios estática atrás das cartas. */
function Sunburst({ className }: { className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => i);
  return (
    <svg viewBox="-100 -100 200 200" className={className} aria-hidden>
      <circle r="98" fill="var(--night-3)" />
      {rays.map((i) => (
        <path key={i} d="M0 0 L-12 -98 L12 -98Z" fill="rgba(255,210,63,0.13)" transform={`rotate(${i * 22.5})`} />
      ))}
      <circle r="98" fill="none" stroke="var(--ink)" strokeWidth="3" />
    </svg>
  );
}

function HeroCards() {
  const [, destaque, epica, especial] = SAMPLE_CARDS;
  return (
    <div className="relative mx-auto aspect-[10/9] w-full max-w-[460px]">
      <Sunburst className="absolute inset-[4%] h-[92%] w-[92%]" />
      <div className="absolute left-[2%] top-[20%] -rotate-[9deg]">
        <PlayerCard player={epica} size="fluid" />
      </div>
      <div className="absolute right-[2%] top-[20%] rotate-[9deg]">
        <PlayerCard player={destaque} size="fluid" />
      </div>
      <div className="absolute left-1/2 top-[6%] -translate-x-1/2">
        <PlayerCard player={especial} size="fluid" className="scale-[1.12] origin-top" />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden border-b-[3px] border-[var(--ink)]">
      <Art
        name="hero-stadium"
        width={1672}
        height={941}
        eager
        sizes="100vw"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-90"
        fallback={
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--grass-3)]/40 to-transparent"
          />
        }
      />

      {/* escurece a esquerda (texto) e a base para manter a leitura */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,rgba(29,22,80,0.85)_40%,rgba(29,22,80,0.35)_75%,rgba(29,22,80,0.2)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(29,22,80,0.55)_0%,rgba(29,22,80,0.9)_55%,var(--night)_100%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-20">
        <div className="text-center lg:text-left">
          <span className="tag">
            <span className="h-2 w-2 rounded-full bg-[var(--red)]" />
            Manager de futebol online
          </span>

          <h1 className="t-display mt-5 text-[2.6rem] sm:text-6xl lg:text-[4.2rem]">
            O técnico
            <br />
            é <span className="text-[var(--sun)]">você.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl lg:mx-0">
            Monte seu elenco com cartas, arme a tática na prancheta e acompanhe cada rodada simulada{" "}
            <strong className="font-extrabold text-white">lance a lance</strong> contra técnicos de verdade. Direto no
            navegador, sem instalar nada.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a href="#comecar" className="btn btn-green btn-lg">
              Criar meu clube grátis
            </a>
            <a href="#ao-vivo" className="btn btn-ghost btn-lg">
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
                <path d="M5 3l12 7-12 7z" fill="currentColor" />
              </svg>
              Como é uma partida
            </a>
          </div>

          <p className="mt-5 text-sm font-semibold text-[var(--sky)]">
            Curtia Brasfoot? Aqui você se sente em casa — só que online e contra gente de verdade.
          </p>
        </div>

        <HeroCards />
      </div>

      {/* faixa de números */}
      <div className="relative border-t-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 divide-[var(--ink)] px-4 sm:px-6 md:grid-cols-4 md:divide-x-[3px]">
          {[
            ["4", "raridades de carta"],
            ["6", "divisões para subir"],
            ["4", "copas pelo caminho"],
            ["0", "downloads necessários"],
          ].map(([n, label]) => (
            <li key={label} className="flex items-center justify-center gap-3 py-4 md:py-5">
              <span className="t-num text-3xl text-[var(--sun)]">{n}</span>
              <span className="max-w-[7rem] text-sm font-bold leading-tight text-white/75">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
