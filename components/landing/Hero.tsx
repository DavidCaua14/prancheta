import { PlayerCard } from "@/components/ui/PlayerCard";
import { SAMPLE_CARDS } from "./sample-cards";

function Floodlight({ className = "", id }: { className?: string; id: string }) {
  return (
    <svg viewBox="0 0 120 200" className={className} aria-hidden overflow="visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fffbe0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M40 60 L-60 320 L200 320 L80 60Z" fill={`url(#${id})`} className="anim-flash" />
      <rect x="54" y="60" width="12" height="140" fill="#3b2f7a" stroke="var(--toon-ink)" strokeWidth="4" />
      <rect x="20" y="10" width="80" height="52" rx="6" fill="#4a3d96" stroke="var(--toon-ink)" strokeWidth="4" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <circle key={`${r}${c}`} cx={32 + c * 19} cy={22 + r * 15} r="6" fill="#fffbe0" stroke="var(--toon-ink)" strokeWidth="2.5" />
        )),
      )}
    </svg>
  );
}

function Crowd() {
  // Torcida em silhuetas cartoon: cabeças + braços levantados.
  const heads = Array.from({ length: 28 }, (_, i) => i);
  const colors = ["#ff4f8b", "#3ec5ff", "#ffd23f", "#34c759", "#ff8a1f", "#8b5cf6"];
  return (
    <svg viewBox="0 0 560 70" preserveAspectRatio="none" className="h-16 w-full sm:h-24" aria-hidden>
      <rect x="0" y="34" width="560" height="40" fill="#120b2e" />
      {heads.map((i) => {
        const x = 10 + i * 20;
        const y = 30 + ((i * 7) % 3) * 5;
        return (
          <g key={i}>
            <rect x={x - 8} y={y + 8} width="16" height="30" rx="6" fill={colors[i % colors.length]} stroke="var(--toon-ink)" strokeWidth="2.5" />
            <circle cx={x} cy={y} r="7" fill="#2a1f5e" stroke="var(--toon-ink)" strokeWidth="2.5" />
            {i % 4 === 0 && (
              <path d={`M${x + 6} ${y + 10} L${x + 12} ${y - 10}`} stroke="#2a1f5e" strokeWidth="4" strokeLinecap="round" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Hero() {
  const [base, destaque, epica, especial] = SAMPLE_CARDS;
  return (
    <section className="relative overflow-hidden border-b-4 border-[var(--toon-ink)]">
      <Floodlight id="beam-l" className="pointer-events-none absolute -left-6 top-0 w-28 opacity-90 sm:w-40" />
      <Floodlight id="beam-r" className="pointer-events-none absolute -right-6 top-0 w-28 -scale-x-100 opacity-90 sm:w-40" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-6 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div className="text-center md:text-left">
          <span className="toon-chip anim-pop bg-[var(--toon-sun)]">
            <span className="anim-blink h-2 w-2 rounded-full bg-[var(--toon-red)]" />
            Manager de futebol 100% online
          </span>
          <h1 className="toon-title mt-4 text-[2.6rem] sm:text-6xl lg:text-7xl">
            Aquele manager dos <span className="text-[var(--toon-sun)]">anos 90</span> voltou.{" "}
            <span className="text-[var(--toon-grass)]">Agora online!</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg font-bold text-white/90 md:mx-0">
            Monte seu clube, escale o time, ajuste a tática e veja a partida simulada{" "}
            <strong className="text-[var(--toon-sun)]">lance a lance</strong> contra técnicos de verdade. Direto no
            navegador do celular, sem baixar nada.
          </p>
          <p className="mx-auto mt-3 max-w-xl font-black text-[var(--toon-sky)] md:mx-0">
            Jogou Brasfoot no PC da escola? Então você já sabe jogar.
          </p>
          <div className="mt-7 flex flex-col items-center gap-4 sm:flex-row md:justify-start">
            <a href="#comecar" className="toon-btn toon-btn-green text-xl">
              Criar meu clube grátis
            </a>
            <a href="#ao-vivo" className="toon-btn toon-btn-white text-lg">
              ▶ Ver um jogo
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-2 text-xs md:justify-start">
            <li className="toon-chip bg-white">Grátis pra começar</li>
            <li className="toon-chip bg-[var(--toon-sky)]">Roda no celular</li>
            <li className="toon-chip bg-[var(--toon-hot)] text-white">PvP de verdade</li>
          </ul>
        </div>

        <div className="relative mx-auto h-[330px] w-full max-w-[420px] sm:h-[380px]">
          <div className="toon-burst anim-spin-slow absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 bg-[var(--toon-orange)] opacity-90 sm:h-[360px] sm:w-[360px]" />
          <div className="absolute left-[2%] top-[16%] -rotate-12">
            <PlayerCard player={base} className="scale-90" />
          </div>
          <div className="absolute right-[2%] top-[14%] rotate-12">
            <PlayerCard player={epica} className="scale-90" />
          </div>
          <div className="absolute left-[18%] top-[30%] -rotate-3 max-sm:hidden">
            <PlayerCard player={destaque} className="scale-90" />
          </div>
          <div className="anim-bob absolute left-1/2 top-[4%] -translate-x-1/2 rotate-2">
            <PlayerCard player={especial} />
          </div>
        </div>
      </div>

      <Crowd />
    </section>
  );
}
