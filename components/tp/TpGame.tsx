"use client";
/* eslint-disable @next/next/no-img-element -- artes e escudos já otimizados em WebP */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ART } from "@/lib/art-manifest";
import { clockText } from "@/components/match/parts";
import { POSTURES } from "@/lib/tactics/lineup";
import type { MatchResult } from "@/lib/sim/engine";
import { CrestArt, TpCrest } from "./CrestArt";
import { START_CLUBS, tpClub } from "@/lib/tp/proto/clubs";
import { PROTO_KEY, ROUNDS, fixtures, newCareer, nextMatch, playRound, repLabel, standings, teamOf, type Career, type Msg } from "@/lib/tp/proto/career";
import { PromoCard, PromoHero, PromoSide, PromoStrip, ONLINE_URL } from "./Promo";

function load(): Career | null {
  try {
    const raw = localStorage.getItem(PROTO_KEY);
    const c = raw ? (JSON.parse(raw) as Career) : null;
    return c?.v === 1 ? c : null;
  } catch {
    return null;
  }
}
function save(c: Career | null) {
  try {
    if (c) localStorage.setItem(PROTO_KEY, JSON.stringify(c));
    else localStorage.removeItem(PROTO_KEY);
  } catch {}
}

function Panel({ children, className = "", title, right }: { children: ReactNode; className?: string; title?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="t-heading">{title}</p>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type Tab = "sede" | "tabela" | "caixa" | "elenco";

export function TpGame() {
  const [career, setCareer] = useState<Career | null | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carreira salva no aparelho
    setCareer(load());
  }, []);
  const update = useCallback((c: Career | null) => {
    save(c);
    setCareer(c);
  }, []);

  if (career === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }
  return career ? <Sede career={career} onChange={update} /> : <NewCareer onStart={update} />;
}

/* ------------------------------------------------------------ começar */

function NewCareer({ onStart }: { onStart: (c: Career) => void }) {
  const [coach, setCoach] = useState("");
  const [club, setClub] = useState<string | null>(null);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-3 pb-16 pt-4 sm:px-6">
      <TpTopBar />
      <Panel className="!bg-[var(--hot)] halftone">
        <span className="tag bg-white">Nova carreira</span>
        <p className="t-display mt-2 text-3xl sm:text-4xl">Escolha onde começar</p>
        <p className="mt-1 text-sm font-semibold text-white/90">Todo grande técnico começou por baixo. Escolha um clube da Série D e leve-o ao topo.</p>
        <label className="mt-4 block text-xs font-extrabold uppercase tracking-wider text-white/85">
          Seu nome de técnico
          <input
            value={coach}
            onChange={(e) => setCoach(e.target.value)}
            maxLength={24}
            placeholder="Ex.: Professor Caua"
            className="mt-1 h-11 w-full rounded-xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-3 text-base font-bold text-[var(--ink)] outline-none placeholder:text-[var(--ink)]/40"
          />
        </label>
      </Panel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {START_CLUBS.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setClub(c.slug)}
            aria-pressed={club === c.slug}
            className={`flex items-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] p-2 text-left shadow-[0_4px_0_var(--ink)] transition-transform active:translate-y-1 ${
              club === c.slug ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-[var(--paper)] text-[var(--ink)]"
            }`}
          >
            <TpCrest slug={c.slug} size={128} className="h-12 w-12 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold">{c.name}</span>
              <span className="block text-[0.7rem] font-bold opacity-65">Série D · {c.uf}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="sticky bottom-3 z-20">
        <button
          type="button"
          disabled={!club}
          onClick={() => club && onStart(newCareer(coach, club))}
          className="btn btn-green btn-lg w-full disabled:opacity-60"
        >
          <Icon name="clipboard" className="h-5 w-5" />
          {club ? `Assinar com o ${tpClub(club).name}` : "Escolha um clube"}
        </button>
      </div>

      <PromoCard slot="loading" />
    </div>
  );
}

/* ---------------------------------------------------------------- sede */

function TpTopBar({ right }: { right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-white">
      <Link href="/temporadas" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10" aria-label="Voltar">
        <Icon name="back" className="h-5 w-5" />
      </Link>
      <img src={ART["icon-temporadas"]} alt="" className="h-10 w-10 object-contain" />
      <div className="min-w-0 flex-1">
        <p className="t-heading truncate">Prancheta Temporadas</p>
        <p className="truncate text-xs font-bold text-white/60">Protótipo · modo carreira</p>
      </div>
      {right}
      <a href={ONLINE_URL("nav-online")} className="btn btn-sm shrink-0 !bg-[var(--hot)] !text-white">
        <Icon name="bolt" className="h-4 w-4" /> Online
      </a>
    </div>
  );
}

function Sede({ career: c, onChange }: { career: Career; onChange: (c: Career | null) => void }) {
  const [tab, setTab] = useState<Tab>("sede");
  const [last, setLast] = useState<{ round: number; index: number; result: MatchResult; home: boolean } | null>(null);
  const me = tpClub(c.club);
  const table = useMemo(() => standings(c), [c]);
  const pos = table.findIndex((t) => t.slot === 0) + 1;
  const nm = nextMatch(c);
  const unread = c.inbox.filter((m) => !m.read).length;

  function play() {
    const out = playRound(c);
    onChange(out.career);
    if (out.mine) setLast({ round: c.round, ...out.mine });
  }

  const tabs: [Tab, string, ReactNode][] = [
    ["sede", "Sede", <Icon key="h" name="home" className="h-5 w-5" />],
    ["tabela", "Tabela", <Icon key="t" name="trophy" className="h-5 w-5" />],
    ["caixa", "Caixa", <span key="c" className="relative"><Icon name="clipboard" className="h-5 w-5" />{unread > 0 && <span className="absolute -right-2 -top-1.5 rounded-full bg-[var(--red)] px-1 text-[0.6rem] text-white">{unread}</span>}</span>],
    ["elenco", "Elenco", <Icon key="e" name="cards" className="h-5 w-5" />],
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-6">
          <Link href="/temporadas" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <TpCrest slug={c.club} size={128} className="h-11 w-11 shrink-0" />
          <div className="min-w-0 flex-1 text-white">
            <p className="t-heading truncate">{me.name}</p>
            <p className="truncate text-xs font-bold text-white/60">
              Série D · Grupo · {pos}º · {c.coach}
            </p>
          </div>
          <span className="flex shrink-0 flex-col items-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2 py-0.5 text-[var(--ink)]" title="Reputação do técnico">
            <span className="text-[0.55rem] font-extrabold uppercase leading-none tracking-wider">Rep.</span>
            <span className="t-num text-lg leading-none">{Math.round(c.rep)}</span>
          </span>
          <nav className="ml-2 hidden gap-1 lg:flex" aria-label="Seções">
            {tabs.map(([id, label, icon]) => (
              <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold ${tab === id ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80 hover:bg-white/10"}`}>
                {icon}
                {label}
              </button>
            ))}
            <a href={ONLINE_URL("nav-online")} className="flex items-center gap-1.5 rounded-xl bg-[var(--hot)] px-3 py-2 text-sm font-extrabold text-white">
              <Icon name="bolt" className="h-5 w-5" /> Online
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-4 sm:px-6 lg:pb-10">
        {tab === "sede" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              <PromoHero />

              {/* próximo jogo */}
              {nm ? (
                <Panel className="relative overflow-hidden !p-0">
                  <div className="pitch absolute inset-0 opacity-25" aria-hidden />
                  <div className="relative p-4">
                    <div className="flex items-center justify-between text-xs font-extrabold text-white/80">
                      <span className="tag bg-[var(--sky)] text-[var(--ink)]">Próximo jogo</span>
                      <span>
                        Rodada {c.round + 1}/{ROUNDS} · {nm.home ? "em casa" : "fora"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                      <MatchSide slug={c.group[nm.home ? 0 : nm.rival]} />
                      <span className="t-display text-3xl text-[var(--sun)]">×</span>
                      <MatchSide slug={c.group[nm.home ? nm.rival : 0]} />
                    </div>
                    <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-white/70">Postura do time</p>
                    <div className="mt-1.5 grid grid-cols-5 gap-1 rounded-xl border-[3px] border-[var(--ink)] bg-black/25 p-1" role="radiogroup" aria-label="Postura">
                      {POSTURES.map((p, i) => (
                        <button
                          key={p.label}
                          type="button"
                          role="radio"
                          aria-checked={c.posture === i}
                          onClick={() => onChange({ ...c, posture: i })}
                          className={`min-h-10 rounded-lg px-0.5 text-[0.62rem] font-extrabold leading-tight sm:text-xs ${c.posture === i ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80"}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-white/65">{POSTURES[c.posture].hint}</p>
                    <button type="button" onClick={play} className="btn btn-green btn-lg mt-4 w-full">
                      <Icon name="play" className="h-5 w-5" /> Jogar a rodada
                    </button>
                  </div>
                </Panel>
              ) : (
                <SeasonEnd career={c} pos={pos} onRestart={() => onChange(null)} />
              )}

              <Panel title={`Grupo da Série D · ${pos}º lugar`} right={<button type="button" onClick={() => setTab("tabela")} className="text-xs font-extrabold text-[var(--sun)]">Tabela completa →</button>}>
                <MiniTable career={c} limit={4} />
              </Panel>

              <PromoStrip slot="market" />
            </div>

            <aside className="flex min-w-0 flex-col gap-4">
              <Panel title="Carreira">
                <div className="flex items-center gap-3">
                  <span className="t-num flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--sun)] text-2xl text-[var(--ink)]">{Math.round(c.rep)}</span>
                  <div className="min-w-0">
                    <p className="font-extrabold">{c.coach}</p>
                    <p className="text-sm text-white/70">Reputação: {repLabel(c.rep)}</p>
                    <p className="text-xs text-white/55">Vitórias e títulos trazem propostas de clubes maiores.</p>
                  </div>
                </div>
              </Panel>
              <Panel title="Caixa de entrada" right={unread ? <span className="tag bg-[var(--red)] text-white">{unread} nova{unread > 1 ? "s" : ""}</span> : null}>
                <InboxList career={c} onChange={onChange} limit={3} />
              </Panel>
              <PromoSide />
            </aside>
          </div>
        )}

        {tab === "tabela" && (
          <div className="flex flex-col gap-4">
            <Panel title="Série D · Grupo">
              <MiniTable career={c} />
            </Panel>
            <Panel title="Rodadas">
              <Rounds career={c} />
            </Panel>
          </div>
        )}

        {tab === "caixa" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <Panel title="Caixa de entrada">
              <InboxList career={c} onChange={onChange} />
            </Panel>
            <PromoCard slot="inbox" />
          </div>
        )}

        {tab === "elenco" && <Squad career={c} />}
      </div>

      {/* menu inferior (celular) */}
      <nav aria-label="Menu do jogo" className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map(([id, label, icon]) => (
            <li key={id}>
              <button type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex w-full flex-col items-center gap-0.5 py-2 text-[0.68rem] font-extrabold ${tab === id ? "text-[var(--sun)]" : "text-white/65"}`}>
                {icon}
                {label}
              </button>
            </li>
          ))}
          <li>
            <a href={ONLINE_URL("nav-online")} className="flex w-full flex-col items-center gap-0.5 py-2 text-[0.68rem] font-extrabold text-[var(--hot)]">
              <img src={ART["icon-pvp"]} alt="" className="h-5 w-5 object-contain" />
              Online
            </a>
          </li>
        </ul>
      </nav>

      {last && <MatchResultSheet career={c} last={last} onClose={() => setLast(null)} />}
    </div>
  );
}

function MatchSide({ slug }: { slug: string }) {
  const club = tpClub(slug);
  return (
    <div className="flex min-w-0 flex-col items-center">
      <TpCrest slug={slug} size={128} className="h-16 w-16 drop-shadow-[0_3px_0_var(--ink)] sm:h-20 sm:w-20" />
      <p className="mt-1 max-w-full truncate text-sm font-extrabold text-white">{club.name}</p>
      <p className="text-[0.65rem] font-bold text-white/60">{club.uf}</p>
    </div>
  );
}

function MiniTable({ career: c, limit }: { career: Career; limit?: number }) {
  const rows = standings(c).slice(0, limit ?? 99);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[0.65rem] font-extrabold uppercase tracking-wider text-white/55">
          <th className="w-7 text-left">#</th>
          <th className="text-left">Clube</th>
          <th className="w-8">J</th>
          <th className="hidden w-8 sm:table-cell">V</th>
          <th className="hidden w-8 sm:table-cell">SG</th>
          <th className="w-10">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.slug} className={`border-t border-white/10 ${r.slot === 0 ? "bg-[var(--sun)]/20 font-extrabold" : ""}`}>
            <td className={`py-1.5 t-num ${i < 4 ? "text-[var(--grass)]" : "text-white/60"}`}>{i + 1}</td>
            <td className="py-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <TpCrest slug={r.slug} className="h-7 w-7 shrink-0" />
                <span className="truncate">{tpClub(r.slug).name}</span>
              </span>
            </td>
            <td className="t-num text-center">{r.p}</td>
            <td className="t-num hidden text-center sm:table-cell">{r.w}</td>
            <td className="t-num hidden text-center sm:table-cell">{r.gf - r.ga}</td>
            <td className="t-num text-center text-[var(--sun)]">{r.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Rounds({ career: c }: { career: Career }) {
  if (!c.results.length) return <p className="text-sm text-white/70">Nenhuma rodada jogada ainda.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {[...c.results.keys()].reverse().map((r) => (
        <div key={r} className="rounded-xl bg-white/5 p-2">
          <p className="mb-1 text-xs font-extrabold uppercase text-white/55">Rodada {r + 1}</p>
          {c.results[r].map(([h, a], i) => {
            const f = fixtures[r][i];
            const mine = f.home === 0 || f.away === 0;
            return (
              <div key={i} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-0.5 text-xs ${mine ? "font-extrabold text-[var(--sun)]" : ""}`}>
                <span className="flex min-w-0 items-center justify-end gap-1.5">
                  <span className="truncate">{tpClub(c.group[f.home]).name}</span>
                  <TpCrest slug={c.group[f.home]} className="h-5 w-5 shrink-0" />
                </span>
                <span className="t-num rounded bg-[var(--ink)] px-1.5">
                  {h}-{a}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <TpCrest slug={c.group[f.away]} className="h-5 w-5 shrink-0" />
                  <span className="truncate">{tpClub(c.group[f.away]).name}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function InboxList({ career: c, onChange, limit }: { career: Career; onChange: (c: Career) => void; limit?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = [...c.inbox].reverse().slice(0, limit ?? 99);
  const mark = (m: Msg) => {
    setOpen(open === m.id ? null : m.id);
    if (!m.read) onChange({ ...c, inbox: c.inbox.map((x) => (x.id === m.id ? { ...x, read: true } : x)) });
  };
  return (
    <ul className="flex flex-col gap-2">
      {list.map((m) => (
        <li key={m.id} className={`rounded-xl border-2 ${m.read ? "border-transparent bg-white/5" : "border-[var(--sun)] bg-white/10"}`}>
          <button type="button" onClick={() => mark(m)} className="flex w-full items-center gap-2.5 p-2 text-left">
            {m.kind === "online" ? <img src={ART["promo-online-carta"]} alt="" className="h-10 w-10 shrink-0 object-contain" /> : <TpCrest slug={m.from} className="h-10 w-10 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">{m.title}</span>
              <span className="block truncate text-xs text-white/60">{m.kind === "online" ? "Prancheta Online" : m.kind === "offer" ? "Proposta de emprego" : "Diretoria"} · rodada {m.round}</span>
            </span>
            {!m.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--sun)]" />}
          </button>
          {open === m.id && (
            <div className="border-t border-white/10 p-3 text-sm text-white/85">
              {m.kind === "offer" && m.offer && <CrestArt art="promo-tp-proposta" clubs={[m.offer]} className="mb-3 overflow-hidden rounded-xl border-[3px] border-[var(--ink)]" />}
              <p>{m.body}</p>
              {m.kind === "online" && (
                <a href={ONLINE_URL("inbox")} className="btn btn-sm mt-3 !bg-[var(--hot)] !text-white">
                  Conhecer o Prancheta Online
                </a>
              )}
              {m.kind === "offer" && m.offer && !c.offers.includes(m.offer) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onChange({ ...c, offers: [...c.offers, m.offer!], rep: Math.min(100, c.rep + 3) })} className="btn btn-paper btn-sm">
                    Recusar e ficar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...c,
                        offers: [...c.offers, m.offer!],
                        inbox: [
                          ...c.inbox,
                          { id: `offer-ok-${m.offer}`, round: c.round, kind: "news", from: m.offer!, title: "Versão completa: troca de clube", body: "No Prancheta Temporadas completo, aceitar leva você ao novo clube com outro elenco, orçamento e objetivos. Neste protótipo, a carreira continua aqui." },
                        ],
                      })
                    }
                    className="btn btn-green btn-sm"
                  >
                    Aceitar
                  </button>
                </div>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Squad({ career: c }: { career: Career }) {
  const t = teamOf(c, 0);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Panel title={`Elenco do ${tpClub(c.club).name}`} className="!p-0 [&>div]:px-4 [&>div]:pt-4">
        <p className="px-4 pb-2 text-xs text-white/60">Protótipo: jogadores ilustrativos. Na versão completa, o elenco real do clube, com atributos que fazem diferença na tática.</p>
        <ul>
          {t.squad.map((p, i) => (
            <li key={p.key} className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-sm">
              <span className="w-10 shrink-0 rounded bg-[var(--ink)] px-1 text-center text-[0.65rem] font-extrabold">{p.position}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
              <span className="text-xs text-white/55">{p.age} anos</span>
              <span className={`t-num w-8 text-right ${t.lineup.xi.includes(i) ? "text-[var(--grass)]" : "text-white/60"}`}>{p.overall}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="flex flex-col gap-4">
        <CrestArt art="promo-tp-elenco" clubs={[c.club]} className="overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] shadow-[0_5px_0_var(--ink)]" />
        <PromoStrip slot="market" />
      </div>
    </div>
  );
}

function SeasonEnd({ career: c, pos, onRestart }: { career: Career; pos: number; onRestart: () => void }) {
  return (
    <Panel className="!p-0 overflow-hidden">
      <div className="relative">
        <img src={ART["promo-online-temporada"]} alt="" className="block w-full" />
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-[rgba(27,16,56,0.85)] to-transparent p-4 text-center">
          <p className="t-display text-2xl sm:text-3xl">{pos === 1 ? "Campeão do grupo!" : `Temporada encerrada · ${pos}º`}</p>
          <p className="text-sm font-semibold text-white/85">
            {c.coach} · reputação {Math.round(c.rep)} ({repLabel(c.rep)})
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-4 sm:flex-row">
        <a href={ONLINE_URL("season-end")} className="btn btn-lg flex-1 !bg-[var(--hot)] !text-white">
          Enfrente técnicos de verdade no online
        </a>
        <button type="button" onClick={onRestart} className="btn btn-paper btn-lg">
          Nova carreira
        </button>
      </div>
    </Panel>
  );
}

function MatchResultSheet({ career: c, last, onClose }: { career: Career; last: { round: number; index: number; result: MatchResult; home: boolean }; onClose: () => void }) {
  const f = fixtures[last.round][last.index];
  const [h, a] = last.result.score;
  const gf = last.home ? h : a;
  const ga = last.home ? a : h;
  const won = gf > ga;
  const goals = last.result.events.filter((e) => e.type === "goal" || e.type === "penalty_goal");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(27,16,56,0.75)] sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal aria-label="Resultado" onClick={(e) => e.stopPropagation()} className="anim-pop max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] text-white shadow-[0_6px_0_var(--ink)] sm:rounded-[24px]">
        <div className="p-4">
          <p className="text-center text-xs font-extrabold uppercase tracking-wider text-white/60">Fim de jogo · rodada {last.round + 1}</p>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <MatchSide slug={c.group[f.home]} />
            <span className="t-num rounded-xl bg-[var(--ink)] px-3 py-1 text-3xl">
              {h}
              <span className="mx-1 text-[var(--sun)]">×</span>
              {a}
            </span>
            <MatchSide slug={c.group[f.away]} />
          </div>
          <p className={`mt-3 text-center t-display text-2xl ${won ? "text-[var(--grass)]" : gf === ga ? "text-[var(--sun)]" : "text-[var(--red)]"}`}>{won ? "Vitória!" : gf === ga ? "Empate" : "Derrota"}</p>
          {goals.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 rounded-xl bg-[var(--paper)] p-2 text-sm text-[var(--ink)]">
              {goals.map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="t-num w-9 shrink-0 text-[var(--hot)]">{clockText(e)}</span>
                  <TpCrest slug={c.group[e.team === 0 ? f.home : f.away]} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">{e.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <PromoCard slot={won ? "match-win" : "match-loss"} compact className="mx-4" />
        <div className="sticky bottom-0 bg-[var(--night-2)] p-4">
          <button type="button" onClick={onClose} className="btn btn-paper w-full">
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
