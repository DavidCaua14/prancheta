"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MascotTipInline } from "@/components/game/MascotTip";
import { GameCard } from "@/components/cards/GameCard";
import { MiniPitch } from "@/components/cards/MiniPitch";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { signOut } from "@/lib/club/api";
import { decodeCrest, decodeKit } from "@/lib/club/identity";
import { clockAt, clubMatchXp, fmtCountdown, fmtKickoff, matchAt, matchDone, standings } from "@/lib/league/data";
import { levelFromXp } from "@/lib/cards/evolution";
import { CARD_TIERS } from "@/lib/game-config";
import { divisionInfo } from "@/lib/league/divisions";
import { useLeague, useNow } from "@/lib/league/useLeague";
import { SeasonSummary } from "@/components/league/SeasonSummary";
import { scoreAt } from "@/components/league/LeagueHub";
import { clubCards } from "@/lib/cards/squad";
import { FORMATIONS, strength } from "@/lib/tactics/formations";
import { POSTURES, lineupFor } from "@/lib/tactics/lineup";
import { CrestSvg } from "./CrestSvg";
import { KitSvg } from "./KitSvg";

type Tab = "inicio" | "elenco" | "jogos" | "leilao" | "clube";

const NAV: { id: Tab; label: string; icon: string; fallback: IconName }[] = [
  { id: "inicio", label: "Início", icon: "icon-inicio", fallback: "home" },
  { id: "elenco", label: "Elenco", icon: "icon-elenco", fallback: "cards" },
  { id: "jogos", label: "Jogos", icon: "icon-ao-vivo", fallback: "tv" },
  { id: "leilao", label: "Leilão", icon: "icon-leilao", fallback: "gavel" },
  { id: "clube", label: "Clube", icon: "icon-clube", fallback: "shield" },
];

/** Ícone com reserva: arte própria, depois arte alternativa, depois ícone SVG. */
function NavIcon({ icon, alt, fallback, className }: { icon: string; alt?: string; fallback: IconName; className: string }) {
  const emoji = (
    <span className={`${className} flex items-center justify-center`}>
      <Icon name={fallback} className="h-[70%] w-[70%]" />
    </span>
  );
  return (
    <ArtImg
      name={icon}
      className={`${className} object-contain`}
      fallback={alt ? <ArtImg name={alt} className={`${className} object-contain`} fallback={emoji} /> : emoji}
    />
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] ${className}`}>
      {children}
    </section>
  );
}

function Soon({ title, text }: { title: string; text: string }) {
  return (
    <Panel className="flex flex-col items-center px-6 py-12 text-center">
      <span className="tag">Em breve</span>
      <h2 className="t-display mt-4 text-2xl">{title}</h2>
      <p className="mt-2 max-w-sm text-white/70">{text}</p>
    </Panel>
  );
}

/** Barra de XP do nível atual + o que entra no fim da temporada. */
function XpBar({ xp, pending }: { xp: number; pending: number }) {
  const max = CARD_TIERS.base.maxLevel;
  const now = levelFromXp(xp, max);
  const after = levelFromXp(xp + pending, max);
  const pct = now.max ? 100 : Math.round((now.into / now.need) * 100);
  const pctAfter = now.max ? 100 : after.level > now.level ? 100 : Math.round(((now.into + pending) / now.need) * 100);
  return (
    <div className="w-full max-w-[9.5rem] text-[0.62rem] font-extrabold leading-tight text-white/80">
      <div className="relative h-2 overflow-hidden rounded-full border border-[var(--ink)] bg-black/40" aria-hidden>
        <div className="absolute inset-y-0 left-0 bg-[var(--sun)]/45" style={{ width: `${pctAfter}%` }} />
        <div className="absolute inset-y-0 left-0 bg-[var(--sun)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 flex justify-between gap-1">
        <span>{now.max ? "Nível máximo" : `${now.into}/${now.need} XP`}</span>
        {pending > 0 && !now.max && (
          <span className={after.level > now.level ? "text-[var(--grass)]" : "text-[var(--sun)]"}>{after.level > now.level ? `Nv ${after.level}!` : `+${pending}`}</span>
        )}
      </p>
    </div>
  );
}

/** Tela inicial do jogo (protótipo). */
export function ClubHome({ mascot }: { mascot: ReactNode }) {
  const router = useRouter();
  const { club, data: league, joining, season, dismissSeason } = useLeague();
  const now = useNow(1000);
  const [tab, setTab] = useState<Tab>("inicio");
  const [isNew, setIsNew] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê ?novo=1 da URL uma vez
    setIsNew(new URLSearchParams(window.location.search).has("novo"));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const cards = useMemo(() => (club ? clubCards(club.id, club.squad, club.xp) : []), [club]);
  // meu jogo ao vivo ou o próximo, e minha posição
  const minute = Math.floor(now / 60_000);
  const leagueInfo = useMemo(() => {
    if (!league || !club || club.league_slot === null) return null;
    const clock = clockAt(league, minute * 60_000);
    const slot = club.league_slot;
    const find = (r: number) => matchAt(league, r, league.fixtures[r - 1].findIndex((f) => f.home === slot || f.away === slot));
    const liveMatch = clock.live ? find(clock.live) : null;
    const target = liveMatch && !matchDone(liveMatch, minute * 60_000) ? liveMatch : clock.next ? find(clock.next) : null;
    const pos = standings(league, minute * 60_000).findIndex((r) => r.slot === slot) + 1;
    return { target, pos, total: league.kickoffs.length };
  }, [league, club, minute]);
  // XP ganho nos jogos desta temporada (entra no elenco quando a temporada fecha)
  const pending = useMemo(() => (league && club ? clubMatchXp(league, club.id, minute * 60_000) : null), [league, club, minute]);

  if (!club) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const crest = decodeCrest(club.crest);
  const kit = decodeKit(club.kit);
  const lineup = lineupFor(club.lineup, cards);
  const formation = FORMATIONS[lineup.formation];
  const xiCards = lineup.xi.map((i) => cards[i]);
  const benchCards = cards.filter((_, i) => !lineup.xi.includes(i));
  const ovr = strength(formation, xiCards).ovr;
  const goLineup = () => router.push("/escalacao");
  const div = divisionInfo(league?.league.division ?? club.division);
  const soon = (what: string) => setToast(`${what} chega nas próximas atualizações!`);

  const tiles: { label: string; icon: string; alt?: string; fallback: IconName; action: () => void; ready?: boolean }[] = [
    { label: "Elenco", icon: "icon-elenco", fallback: "cards", action: () => setTab("elenco"), ready: true },
    { label: "Escalação", icon: "icon-tatica", fallback: "clipboard", action: goLineup, ready: true },
    { label: "Liga", icon: div.art, alt: "icon-liga", fallback: "trophy", action: () => router.push("/liga"), ready: true },
    { label: "Treino", icon: "icon-treino", alt: "icon-pvp", fallback: "whistle", action: () => router.push("/partida"), ready: true },
    { label: "Leilão", icon: "icon-leilao", fallback: "gavel", action: () => soon("O leilão") },
    { label: "Copas", icon: "trophy-copa-nacional", fallback: "trophy", action: () => soon("As copas") },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      {season && <SeasonSummary season={season} clubName={club.name} onClose={dismissSeason} />}
      {/* barra de status */}
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-6">
          <span className="hidden lg:block">
            <Logo />
          </span>
          <span className="hidden h-8 w-px bg-white/15 lg:block" />
          <CrestSvg crest={crest} tag={club.tag} className="h-11 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">{club.name}</p>
            <p className="text-xs font-bold text-white/60">
              {div.short}{league ? ` · Grupo #${league.league.id}` : ""}
              {leagueInfo?.pos ? ` · ${leagueInfo.pos}º lugar` : ""}
            </p>
          </div>
          <span className="flex shrink-0 flex-col items-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2.5 py-0.5 text-[var(--ink)]">
            <span className="text-[0.55rem] font-extrabold uppercase leading-none tracking-wider">OVR</span>
            <span className="t-num text-lg leading-none">{ovr}</span>
          </span>
          <nav aria-label="Seções" className="ml-2 hidden gap-1 lg:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => (n.id === "jogos" ? router.push("/liga?aba=jogos") : setTab(n.id))}
                aria-current={tab === n.id ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold transition-colors ${
                  tab === n.id ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <NavIcon icon={n.icon} fallback={n.fallback} className="h-6 w-6" />
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-4 sm:px-6 lg:pb-10">
        {isNew && tab === "inicio" && (
          <MascotTipInline mascot={mascot} always>
            Elenco fechado! O {club.name} já está na Liga da Várzea, com rodadas de 2 em 2 horas. Enquanto o primeiro jogo
            não chega, ajuste a escalação ou faça um treino.
          </MascotTipInline>
        )}

        {tab === "inicio" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
            <div className="flex min-w-0 flex-col gap-4">
              {/* próxima partida (liga) */}
              <Panel className="relative overflow-hidden !p-0">
                <div className="pitch absolute inset-0 opacity-25" aria-hidden />
                {(() => {
                  const m = leagueInfo?.target;
                  if (!m) {
                    return (
                      <div className="relative p-5 text-center">
                        <span className="tag bg-[var(--sky)]">{div.name}</span>
                        <p className="mt-3 font-bold">{joining ? "Procurando uma vaga na liga..." : "Carregando a tabela..."}</p>
                      </div>
                    );
                  }
                  const s = scoreAt(m, now);
                  const live = s.status === "vivo";
                  return (
                    <div className="relative p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`tag ${live ? "bg-[var(--red)] text-white" : "bg-[var(--sky)]"}`}>{live ? (
                            <>
                              <Icon name="dot" className="h-2.5 w-2.5" /> Ao vivo
                            </>
                          ) : (
                            "Próximo jogo"
                          )}</span>
                        <span className="text-xs font-extrabold text-white/70">
                          {div.name} · Rodada {m.round}/{leagueInfo.total}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        {[m.home, null, m.away].map((t, k) =>
                          t ? (
                            <div key={k} className="flex min-w-0 flex-col items-center text-center">
                              <CrestSvg crest={t.crest} tag={t.tag} className="h-20 w-[72px] sm:h-24 sm:w-[86px]" />
                              <p className="mt-1.5 line-clamp-2 text-sm font-extrabold leading-tight">{t.name}</p>
                              {t.bot && <span className="mt-0.5 rounded bg-white/15 px-1 text-[0.55rem] font-extrabold uppercase">CPU</span>}
                            </div>
                          ) : (
                            <div key={k} className="flex flex-col items-center">
                              {live ? (
                                <span className="t-num rounded-lg bg-[var(--ink)] px-3 py-1 text-3xl">
                                  {s.score[0]}-{s.score[1]}
                                </span>
                              ) : (
                                <span className="t-display text-3xl text-[var(--sun)]">VS</span>
                              )}
                              <span className="t-num mt-1 rounded-lg bg-[var(--ink)] px-2 py-0.5 text-xs">{live ? s.clock : fmtKickoff(m.kickoff)}</span>
                              {!live && <span className="mt-1 text-[0.7rem] font-extrabold text-[var(--sun)]">em {fmtCountdown(m.kickoff - now)}</span>}
                            </div>
                          ),
                        )}
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button type="button" onClick={goLineup} className="btn btn-paper">
                          Escalação
                        </button>
                        <button type="button" onClick={() => router.push(`/liga/jogo?r=${m.round}&i=${m.index}`)} className={`btn ${live ? "btn-green" : "btn-paper"}`}>
                          {live ? "Assistir ao vivo" : "Ver jogo"}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </Panel>

              {/* atalhos */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {tiles.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={t.action}
                    className="relative flex flex-col items-center rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-1 pb-2.5 pt-3 text-[var(--ink)] shadow-[0_4px_0_var(--ink)] transition-transform active:translate-y-1 active:shadow-[0_1px_0_var(--ink)]"
                  >
                    {!t.ready && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-[var(--ink)] px-1 text-[0.55rem] font-extrabold uppercase text-white">
                        breve
                      </span>
                    )}
                    <NavIcon icon={t.icon} alt={t.alt} fallback={t.fallback} className="h-11 w-11 sm:h-14 sm:w-14" />
                    <span className="mt-1.5 text-xs font-extrabold sm:text-sm">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* time titular */}
            <Panel>
              <div className="mb-2 flex items-center justify-between">
                <p className="t-heading">Time titular</p>
                <button type="button" onClick={goLineup} className="text-xs font-extrabold text-[var(--sun)]">
                  Editar escalação <Icon name="arrow-right" className="inline h-3.5 w-3.5 align-[-2px]" />
                </button>
              </div>
              <MiniPitch
                cards={xiCards}
                kit={kit}
                slots={formation.slots}
                captain={cards[lineup.captain]}
                showFit
                className="mx-auto max-w-[380px] text-[clamp(10px,3vw,13px)] lg:text-[12px]"
              />
              <p className="mt-2 text-center text-xs font-bold text-white/60">
                {formation.name} · {POSTURES[lineup.posture].label} · OVR {ovr}
              </p>
            </Panel>
          </div>
        )}

        {tab === "elenco" && (
          <div className="flex flex-col gap-4">
            <Panel className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] text-[var(--ink)]">
                <Icon name="bolt" className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-heading">Evolução das cartas</p>
                <p className="mt-0.5 text-sm text-white/75">
                  Cada jogo da liga dá XP: jogar, nota boa, gol, assistência e vitória. Banco também treina. O XP entra no elenco
                  quando a temporada fecha (+40 no acesso, +60 no título) e cada nível vale +1 de overall, até {CARD_TIERS.base.maxOverall} nas
                  cartas Base.
                </p>
                {pending && pending.games > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-[var(--sun)]">
                    <Icon name="clock" className="h-3.5 w-3.5" /> +{pending.xp.reduce((a, b) => a + b, 0)} XP a receber em {pending.games} {pending.games === 1 ? "jogo" : "jogos"} desta temporada
                  </p>
                )}
              </div>
            </Panel>
            {[
              ["Titulares", xiCards],
              ["Reservas", benchCards],
            ].map(([title, list]) => (
              <Panel key={title as string}>
                <p className="t-heading mb-3">
                  {title as string} <span className="text-sm text-white/50">({(list as typeof cards).length})</span>
                </p>
                <div className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
                  {(list as typeof cards).map((c) => {
                    const i = cards.indexOf(c);
                    return (
                      <div key={c.key} className="flex w-full flex-col items-center gap-1.5">
                        <GameCard card={c} kit={kit} tag={club.tag} className="!text-[clamp(8px,2.45vw,12px)]" />
                        <XpBar xp={club.xp?.[i] ?? 0} pending={pending?.xp[i] ?? 0} />
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>
        )}

        {tab === "jogos" && <Soon title="Calendário" text="Rodadas da liga, copas e amistosos, com a partida ao vivo e a narração lance a lance." />}
        {tab === "leilao" && <Soon title="Leilão" text="Cartas Destaque, Épicas e Especiais em disputa entre todos os técnicos." />}

        {tab === "clube" && (
          <Panel className="flex flex-col items-center gap-4 py-8 text-center">
            <CrestSvg crest={crest} tag={club.tag} className="h-36 w-32" title={`Escudo do ${club.name}`} />
            <div>
              <h2 className="t-display text-3xl">{club.name}</h2>
              <p className="mt-1 font-mono font-bold tracking-[0.25em] text-[var(--sun)]">{club.tag}</p>
            </div>
            <KitSvg kit={kit} number={10} className="h-24 w-24" />
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
              className="btn btn-ghost mt-2"
            >
              Sair da conta
            </button>
          </Panel>
        )}
      </div>

      {/* menu inferior (celular) */}
      <nav
        aria-label="Menu do jogo"
        className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => (n.id === "jogos" ? router.push("/liga?aba=jogos") : setTab(n.id))}
                aria-current={tab === n.id ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2 text-[0.68rem] font-extrabold ${
                  tab === n.id ? "text-[var(--sun)]" : "text-white/65"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    tab === n.id ? "border-[3px] border-[var(--ink)] bg-[var(--sun)]" : ""
                  }`}
                >
                  <NavIcon icon={n.icon} fallback={n.fallback} className="h-7 w-7" />
                </span>
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {toast && (
        <div
          role="status"
          className="anim-pop fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-4 py-3 text-center text-sm font-extrabold text-[var(--ink)] shadow-[0_5px_0_var(--ink)] lg:bottom-8"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
