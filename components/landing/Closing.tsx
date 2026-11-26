import { Logo } from "@/components/ui/Logo";
import { APP_VERSION } from "@/lib/version";

const FAQ = [
  {
    q: "É parecido com o Brasfoot?",
    a: "A ideia é a mesma: você é o técnico, monta o time e a partida é simulada. A diferença é que aqui é tudo online, os adversários são outros técnicos de verdade e você pode assistir aos jogos ao vivo e mexer no time durante a partida.",
  },
  {
    q: "Preciso pagar para jogar?",
    a: "Não. Você cria o clube, monta o elenco de cartas Base na peneira e joga ligas, copas e amistosos sem gastar nada. As cartas raras saem no leilão, com as moedas que o clube ganha em prêmios de liga e copa, nas missões semanais e na renda do estádio.",
  },
  {
    q: "E se eu não estiver online na hora do jogo?",
    a: "O jogo acontece do mesmo jeito. Seu time entra com a última escalação e tática salvas. Depois dá para rever a partida inteira, lance a lance.",
  },
  {
    q: "Roda no meu celular?",
    a: "Roda. O Prancheta foi feito para ser leve: abre no navegador, sem instalar nada, e gasta pouca internet.",
  },
  {
    q: "Como as cartas evoluem?",
    a: "Cada jogo da liga dá experiência às cartas (mais para quem joga, faz gol e vence), que entra no fim da temporada. Ao subir de nível, o overall aumenta. Cada carta tem o seu potencial — o nível e o overall máximos dela —, e só as melhores chegam ao teto da raridade: Base, Destaque, Épica ou Especial.",
  },
  {
    q: "Como funciona o leilão?",
    a: "A cada 2 horas, 12 cartas vão a leilão, e cada uma mostra o potencial dela. Todo mundo pode dar lances com as moedas do clube; cada lance novo dá mais 10 minutos para alguém cobrir. Quem tiver o maior lance no fim leva a carta, e outra entra no lugar na hora.",
  },
  {
    q: "Posso jogar contra meus amigos?",
    a: "Pode! Marque um amistoso, escolha o horário e mande o link no grupo. A partida é ao vivo, com os times e as táticas de cada um. Amistoso não vale moedas nem pontos no ranking: é só pela resenha.",
  },
  {
    q: "Como funciona o ranking?",
    a: "Só técnicos de verdade disputam. Cada vitória, empate e goleada na liga pontua logo depois do apito final, assim como cada fase vencida nas copas; título e acesso dão bônus. Quanto mais alta a divisão ou a copa, mais vale. Tem o ranking geral e o da semana.",
  },
  {
    q: "Como meu clube ganha moedas?",
    a: "Com prêmios de fim de temporada e de copa, com as missões dos eventos semanais e com a renda dos jogos em casa: invista no estádio, na lanchonete e na loja oficial para faturar a cada partida.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center sm:mb-14">
          <span className="tag">Dúvidas</span>
          <h2 className="t-display mt-4 text-3xl sm:text-5xl">
            Perguntas <span className="text-[var(--sun)]">frequentes</span>
          </h2>
        </header>
        <div className="grid gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className="panel group overflow-hidden [box-shadow:0_4px_0_var(--ink)]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-base font-extrabold sm:px-5 sm:text-lg [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[3px] border-[var(--ink)] bg-[var(--sun)] text-lg font-extrabold leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="border-t-2 border-dashed border-[var(--ink)]/15 px-4 pb-4 pt-3 leading-relaxed opacity-80 sm:px-5">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="comecar" className="scroll-mt-20 border-t-[3px] border-[var(--ink)] bg-[var(--grass-2)] px-4 py-16 sm:px-6 sm:py-24">
      <div className="panel halftone mx-auto flex max-w-3xl flex-col items-center px-5 py-10 text-center sm:px-10 sm:py-14">
        <Logo size="lg" className="text-left" />
        <h2 className="t-display mt-8 text-3xl text-[var(--ink)] [text-shadow:0.05em_0.05em_0_var(--sun)] sm:text-5xl">
          A bola já vai rolar
        </h2>
        <p className="mt-4 max-w-lg text-lg leading-relaxed opacity-80">
          Crie seu clube e entre na próxima rodada da Várzea. É grátis e leva menos de um minuto.
        </p>
        <a href="/entrar" className="btn btn-green btn-lg mt-8 w-full sm:w-auto">
          Criar meu clube
        </a>
        <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.15em] opacity-50">Entre com sua conta Google</p>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-[3px] border-[var(--ink)] bg-[var(--ink)] px-4 py-10 text-sm text-white/60 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <Logo />
        <nav aria-label="Rodapé" className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-bold">
          <a href="#faq" className="hover:text-white">Dúvidas</a>
          <a href="#" className="hover:text-white">Termos de uso</a>
          <a href="#" className="hover:text-white">Privacidade</a>
          <a href="#" className="hover:text-white">Suporte</a>
        </nav>
        <p className="text-center md:text-right">
          © {process.env.NEXT_PUBLIC_BUILD_YEAR} Prancheta
          <span className="ml-2 font-mono text-xs opacity-60">v{APP_VERSION}</span>
        </p>
      </div>
    </footer>
  );
}
