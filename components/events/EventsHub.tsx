"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { CUP_KINDS, cupStats, loadCup, myLastEntry } from "@/lib/cup/data";
import { claimMission, currentEvent, METRIC_LABEL, myProgress, templates, type Metric, type Progress, type Template, type WeekEvent } from "@/lib/events/data";
import { clubLeagueStats, emptyStats, fmtCountdown, loadLeague } from "@/lib/league/data";
import { useNow } from "@/lib/league/useLeague";

const EVENT_COLORS: Record<string, string> = {
  artilheiro: "from-[var(--hot)] to-[var(--orange)]",
  muralha: "from-[var(--sky)] to-[#6d5bd0]",
  maratona: "from-[var(--grass)] to-[var(--sky)]",
  titulo: "from-[var(--sun)] to-[var(--hot)]",
};

type Pending = Partial<Record<Metric, number>>;

/**
 * O que ainda está "a confirmar": jogos já disputados na temporada e nas copas
 * em andamento. Só entra no progresso oficial quando elas fecharem.
 */
async function pendingStats(club: Club, now: number): Promise<Pending> {
  const out: Pending = {};
  const add = (k: Metric, v: number) => (out[k] = (out[k] ?? 0) + v);
  if (club.league_id) {
    const d = await loadLeague(club.league_id).catch(() => null);
    if (d && !d.league.closed_at) {
      const s = d ? clubLeagueStats(d, club.id, now) : emptyStats();
      add("games", s.games);
      add("wins", s.wins);
      add("goals", s.goals_for);
      add("clean_sheets", s.clean_sheets);
      add("big_wins", s.big_wins);
    }
  }
  for (const kind of Object.keys(CUP_KINDS).map(Number)) {
    const e = await myLastEntry(club.id, kind).catch(() => null);
    if (!e || e.cups.closed_at || now < new Date(e.cups.starts_at).getTime()) continue;
    const d = await loadCup(e.cup_id).catch(() => null);
    if (!d) continue;
    const s = cupStats(d, e.slot, now);
    add("games", s.games);
    add("wins", s.wins);
    add("goals", s.goals_for);
    add("clean_sheets", s.clean_sheets);
    add("big_wins", s.big_wins);
    add("cup_games", s.games);
    add("cup_wins", s.cup_wins);
  }
  return out;
}

function Coins({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <ArtImg name="icon-moeda" className="h-[1.15em] w-[1.15em] object-contain" fallback={<span className="inline-block h-[0.9em] w-[0.9em] rounded-full border-2 border-[var(--ink)] bg-[var(--sun)]" />} />
      <span className="t-num">{value.toLocaleString("pt-BR")}</span>
    </span>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] ${className}`}>{children}</section>;
}

export function EventsHub() {
  const router = useRouter();
  const now = useNow(1000);
  const [club, setClub] = useState<Club | null>(null);
  const [event, setEvent] = useState<WeekEvent | null>(null);
  const [prog, setProg] = useState<{ progress: Progress; claimed: number[] } | null>(null);
  const [pending, setPending] = useState<Pending>({});
  const [list, setList] = useState<Template[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const s = await getSession();
    if (!s) return router.replace("/entrar");
    const c = await getMyClub(s, { fresh: true });
    if (!c) return router.replace("/clube/novo");
    if (!c.squad) return router.replace("/peneira");
    setClub(c);
    try {
      const [ev, p, t] = await Promise.all([currentEvent(), myProgress(), templates()]);
      setEvent(ev);
      setProg(p);
      setList(t);
      setError(false);
      setPending(await pendingStats(c, Date.now()));
    } catch {
      setError(true);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function claim(i: number) {
    setBusy(i);
    const r = await claimMission(i);
    setBusy(null);
    if ("coins" in r) {
      setToast(`+${r.coins.toLocaleString("pt-BR")} moedas! Bora gastar no leilão.`);
      void load();
    } else {
      setToast(r.error === "claimed" ? "Essa recompensa já foi resgatada." : r.error === "incomplete" ? "Ainda falta um pouco para completar." : "Não deu para resgatar. Tente de novo.");
    }
  }

  if (!club || (!event && !error)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const ends = event ? new Date(event.ends_at).getTime() : 0;
  const total = event ? event.missions.reduce((s, m) => s + m.reward, 0) : 0;
  const earned = event && prog ? event.missions.reduce((s, m, i) => s + (prog.claimed.includes(i) ? m.reward : 0), 0) : 0;
  const next = event && list.length ? list[(event.template + 1) % list.length] : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <ArtImg name="icon-eventos" className="h-10 w-10 object-contain" fallback={<Icon name="star" className="h-8 w-8 text-[var(--sun)]" />} />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Eventos</p>
            <p className="truncate text-xs font-bold text-white/60">Moedas grátis por jogar · toda semana</p>
          </div>
          <Link href="/loja" className="flex shrink-0 items-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2.5 py-1 text-[var(--ink)]" aria-label={`${club.coins} moedas — abrir a loja`}>
            <Coins value={club.coins} className="text-base" />
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 pb-12 pt-4 sm:px-6">
        {error && (
          <Panel>
            <p className="font-bold">Não deu para carregar o evento.</p>
            <button type="button" onClick={() => void load()} className="btn btn-green btn-sm mt-3">
              Tentar de novo
            </button>
          </Panel>
        )}

        {event && prog && (
          <>
            {/* faixa do evento */}
            <section className={`relative overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-gradient-to-br ${EVENT_COLORS[event.slug] ?? "from-[var(--sun)] to-[var(--hot)]"} text-[var(--ink)] shadow-[0_5px_0_var(--ink)]`}>
              <ArtImg name={`event-${event.slug}`} className="absolute inset-0 h-full w-full object-cover" fallback={<div className="halftone absolute inset-0 opacity-40" />} />
              <div className="relative bg-gradient-to-t from-[rgba(27,16,56,0.85)] via-[rgba(27,16,56,0.35)] to-transparent p-4 pt-24 text-white sm:pt-32">
                <span className="tag bg-[var(--sun)] text-[var(--ink)]">Evento da semana</span>
                <h1 className="t-display mt-2 text-3xl leading-none sm:text-4xl">{event.name}</h1>
                <p className="mt-1 max-w-xl text-sm font-semibold text-white/90">{event.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-extrabold">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-black/35 px-2 py-1">
                    <Icon name="clock" className="h-3.5 w-3.5" /> Termina em {fmtCountdown(ends - now)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-black/35 px-2 py-1">
                    <Coins value={earned} /> de <Coins value={total} /> resgatadas
                  </span>
                </div>
              </div>
            </section>

            {/* missões */}
            <div className="flex flex-col gap-2.5">
              {event.missions.map((m, i) => {
                const have = prog.progress[m.metric] ?? 0;
                const soon = pending[m.metric] ?? 0;
                const done = have >= m.target;
                const claimed = prog.claimed.includes(i);
                const pct = Math.min(100, Math.round((have / m.target) * 100));
                const pctSoon = Math.min(100, Math.round(((have + soon) / m.target) * 100));
                return (
                  <article key={i} className={`flex items-center gap-3 rounded-[18px] border-[3px] border-[var(--ink)] p-3 shadow-[0_4px_0_var(--ink)] ${claimed ? "bg-white/10 text-white/70" : "bg-[var(--paper)] text-[var(--ink)]"}`}>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] ${claimed ? "bg-[var(--grass)]" : done ? "bg-[var(--sun)]" : "bg-[var(--ink)]/10"}`}>
                      <Icon name={claimed ? "check" : done ? "trophy" : "star"} className="h-6 w-6 text-[var(--ink)]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold leading-tight">{m.label}</p>
                      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-[var(--ink)] bg-black/15" aria-hidden>
                        <div className="relative h-full">
                          <div className="absolute inset-y-0 left-0 bg-[var(--sun)]/50" style={{ width: `${pctSoon}%` }} />
                          <div className="absolute inset-y-0 left-0 bg-[var(--grass)]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <p className="mt-0.5 text-[0.7rem] font-bold opacity-70">
                        {Math.min(have, m.target)}/{m.target} {METRIC_LABEL[m.metric]}
                        {soon > 0 && !done && <span className="text-[var(--orange)]"> · +{soon} a confirmar</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Coins value={m.reward} className="text-sm font-extrabold" />
                      {claimed ? (
                        <span className="text-[0.68rem] font-extrabold">Resgatado</span>
                      ) : (
                        <button type="button" disabled={!done || busy !== null} onClick={() => void claim(i)} className="btn btn-green btn-sm !px-2.5 disabled:opacity-40">
                          {busy === i ? "..." : "Resgatar"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <Panel>
              <p className="t-heading">Como conta</p>
              <ul className="mt-2 space-y-1.5 text-sm text-white/80">
                <li className="flex gap-2">
                  <Icon name="whistle" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> Valem jogos da liga e das copas. O progresso entra quando a temporada ou a copa
                  termina (de segunda 0h a domingo 23h59, Brasília) — o que já jogou e ainda está em andamento aparece como &quot;a confirmar&quot;.
                </li>
                <li className="flex gap-2">
                  <Icon name="gavel" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> Resgate antes do fim da semana e use as moedas no leilão para reforçar o time.
                </li>
                {next && (
                  <li className="flex gap-2">
                    <Icon name="forward" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" />
                    <span>
                      Próxima semana: <b>{next.name}</b>
                    </span>
                  </li>
                )}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/leilao" className="btn btn-green btn-sm">
                  <Icon name="gavel" className="h-4 w-4" /> Ir ao leilão
                </Link>
                <Link href="/copas" className="btn btn-paper btn-sm">
                  <Icon name="trophy" className="h-4 w-4" /> Jogar copas
                </Link>
              </div>
            </Panel>
          </>
        )}
      </div>

      {toast && (
        <div role="status" className="anim-pop fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-sm rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-4 py-3 text-center text-sm font-extrabold text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
          {toast}
        </div>
      )}
    </div>
  );
}
