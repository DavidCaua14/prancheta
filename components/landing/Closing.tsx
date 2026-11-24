import { Logo } from "@/components/ui/Logo";
import { APP_VERSION } from "@/lib/version";

const FAQ = [
  {
    q: "É parecido com o Brasfoot?",
    a: "A alma é a mesma: você é o técnico, monta o time e a partida é simulada. A diferença é que aqui é tudo online, os adversários são outros técnicos de verdade e você pode assistir aos jogos ao vivo e mexer no time durante a partida.",
  },
  {
    q: "Preciso pagar para jogar?",
    a: "Não. Você cria o clube, ganha cartas Base, joga ligas e copas sem gastar nada. Cartas mais raras também podem ser conquistadas com moedas do jogo, em títulos e no leilão.",
  },
  {
    q: "E se eu não estiver online na hora do jogo?",
    a: "O jogo acontece do mesmo jeito. Seu time entra com a última escalação e tática salvas. Depois você pode ver o resumo e os melhores lances.",
  },
  {
    q: "Roda no meu celular?",
    a: "Roda. O Prancheta foi feito para ser leve: abre no navegador, sem instalar nada, e gasta pouca internet.",
  },
  {
    q: "Como as cartas evoluem?",
    a: "Cada partida dá experiência às cartas que jogaram. Ao subir de nível, o overall aumenta até o limite da raridade: Base, Destaque, Épica ou Especial.",
  },
  {
    q: "Como funciona o leilão?",
    a: "Cartas são colocadas em leilão com tempo marcado. Todo mundo pode dar lances com moedas do clube; quem tiver o maior lance quando o martelo bater leva a carta.",
  },
  {
    q: "Posso jogar contra meus amigos?",
    a: "Pode! Marque um amistoso, mande o link e escolham o horário. A partida é simulada com os times e táticas de cada um.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 px-4 py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <span className="toon-chip bg-[var(--toon-sky)]">Dúvidas</span>
        <h2 className="toon-title mt-3 text-4xl sm:text-5xl">
          Perguntas <span className="text-[var(--toon-sun)]">rápidas</span>
        </h2>
      </div>
      <div className="mx-auto grid max-w-4xl gap-3">
        {FAQ.map((item) => (
          <details key={item.q} className="toon-box-sm toon-paper group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-black">
              {item.q}
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--toon-ink)] bg-[var(--toon-sun)] font-black transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2 text-sm font-semibold leading-relaxed opacity-85">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="comecar" className="scroll-mt-28 relative overflow-hidden border-t-4 border-[var(--toon-ink)] bg-[var(--toon-grass-dark)] px-4 py-20">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 60px, rgba(0,0,0,0.12) 60px 120px)" }}
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <Logo size="lg" className="anim-bob flex-col sm:flex-row" />
        <h2 className="toon-title mt-8 text-4xl sm:text-5xl">
          A bola já tá <span className="text-[var(--toon-sun)]">rolando</span>
        </h2>
        <p className="mt-4 text-lg font-bold text-white">
          Crie seu clube agora e entre na próxima rodada da Várzea. É grátis e leva menos de um minuto.
        </p>
        <a href="#comecar" className="toon-btn mt-8 text-2xl" aria-disabled="true">
          Criar meu clube
        </a>
        <p className="mt-3 text-xs font-black uppercase tracking-widest text-white/70">Cadastro abre em breve</p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-4 border-[var(--toon-ink)] bg-[var(--toon-ink)] px-4 py-8 text-center text-sm font-bold text-white/60">
      <nav aria-label="Rodapé" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <a href="#faq" className="hover:text-[var(--toon-sun)]">Dúvidas</a>
        <a href="#" className="hover:text-[var(--toon-sun)]">Termos de uso</a>
        <a href="#" className="hover:text-[var(--toon-sun)]">Privacidade</a>
        <a href="#" className="hover:text-[var(--toon-sun)]">Suporte</a>
      </nav>
      <p className="mt-4">© {process.env.NEXT_PUBLIC_BUILD_YEAR} Prancheta · Feito com chuteira e café ☕</p>
      <p className="mt-1 font-mono text-xs opacity-60">v{APP_VERSION}</p>
    </footer>
  );
}
