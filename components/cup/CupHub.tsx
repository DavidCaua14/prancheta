"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { CUP_KINDS, cupConfig, cupMatch, lastTitle, nextEditionStart, TITLE_VALID_DAYS, WEEKDAYS, pathOf, roundName, roundsOf, slotsIn, type CupData, type CupMatch } from "@/lib/cup/data";
import { divisionInfo } from "@/lib/league/divisions";
import { liveRound, pairsKnown, roundOver, scoresKnown, useCup } from "@/lib/cup/useCup";
import { CUPS } from "@/lib/game-config";
import { fmtCountdown, fmtKickoff, matchDone, TICK_SECONDS } from "@/lib/league/core";
import { useNow } from "@/lib/league/useLeague";
import { clockText } from "@/components/match/parts";

/** Horário "13h" / "11h30" a partir de minutos desde 0h. */
function hhmm(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Nome da fase alcançada: 0 = caiu na 1ª fase ... total = campeão. */
export function reachLabel(reach: number, total: number) {
  if (reach >= total) return "Campeão";
  if (reach === total - 1) return "Vice-campeão";
  return `Caiu na ${roundName(reach + 1, total).toLowerCase()}`;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] ${className}`}>{children}</section>;
}

/** Placar de um jogo de copa num instante (respeita o que já pode ser mostrado). */
function scoreOf(data: CupData, m: CupMatch, now: number) {
  if (!scoresKnown(data, m.round, now)) return { status: "antes" as const, text: fmtKickoff(m.kickoff, false) };
  if (matchDone(m, now)) {
    const [h, a] = m.result.score;
    return { status: "fim" as const, text: `${h}-${a}`, pens: m.shootout ? `${m.shootout.score[0]}-${m.shootout.score[1]} pên.` : null };
  }
  const tick = Math.floor((now - m.kickoff) / (TICK_SECONDS * 1000));
  const seen = m.result.events.filter((e) => e.tick <= tick);
  const last = seen[seen.length - 1];
  return { status: "vivo" as const, text: last ? `${last.score[0]}-${last.score[1]}` : "0-0", clock: last ? clockText(last) : "0'" };
}

function MatchLine({ data, m, now, mySlot }: { data: CupData; m: CupMatch; now: number; mySlot: number | null }) {
  const kind = data.cup.kind;
  const s = scoreOf(data, m, now);
  const mine = m.home.slot === mySlot || m.away.slot === mySlot;
  const won = (side: 0 | 1) => s.status === "fim" && m.winner === side;
  return (
    <Link
      href={`/copas/jogo?k=${kind}&r=${m.round}&i=${m.index}`}
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--ink)]/10 px-3 py-2.5 last:border-0 hover:bg-[var(--cream)] ${mine ? "bg-[var(--sun)]/30" : ""}`}
    >
      <span className={`flex min-w-0 items-center justify-end gap-2 text-right ${s.status === "fim" && !won(0) ? "opacity-50" : ""}`}>
        <span className={`truncate text-sm ${won(0) ? "font-extrabold" : "font-bold"}`}>{m.home.name}</span>
        <CrestSvg crest={m.home.crest} tag={m.home.tag} className="h-8 w-7 shrink-0" />
      </span>
      <span className="flex w-20 flex-col items-center">
        <span className={`t-num rounded-md px-2 text-base leading-tight ${s.status === "vivo" ? "bg-[var(--red)] text-white" : s.status === "fim" ? "bg-[var(--ink)] text-white" : "text-[var(--ink)]/50"}`}>
          {s.status === "antes" ? "×" : s.text}
        </span>
        <span className={`t-num text-[0.62rem] ${s.status === "vivo" ? "text-[var(--red)]" : "opacity-60"}`}>
          {s.status === "vivo" ? s.clock : s.status === "fim" ? (s.pens ?? "Fim") : s.text}
        </span>
      </span>
      <span className={`flex min-w-0 items-center gap-2 ${s.status === "fim" && !won(1) ? "opacity-50" : ""}`}>
        <CrestSvg crest={m.away.crest} tag={m.away.tag} className="h-8 w-7 shrink-0" />
        <span className={`truncate text-sm ${won(1) ? "font-extrabold" : "font-bold"}`}>{m.away.name}</span>
      </span>
    </Link>
  );
}

/** Página das copas: escolhe a copa (?k=0 Várzea, ?k=1 Nacional) e mostra a edição. */
export function CupHub() {
  const [kind, setKind] = useState<number | null>(null);
  useEffect(() => {
    const k = Number(new URLSearchParams(window.location.search).get("k"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a copa pedida na URL uma vez
    setKind(CUP_KINDS[k] ? k : 0);
  }, []);
  if (kind === null) return null;
  const pick = (k: number) => {
    window.history.replaceState(null, "", `/copas?k=${k}`);
    setKind(k);
  };
  return <CupView key={kind} kind={kind} onPick={pick} />;
}

function CupView({ kind, onPick }: { kind: number; onPick: (k: number) => void }) {
  const KIND = cupConfig(kind);
  const { club, entry, data, ready, joining, error, join, reload } = useCup(kind);
  // Supercopa: precisa de um título de divisão recente (o banco confere de novo na inscrição)
  const [title, setTitle] = useState<{ closed_at: string; division: number } | null | undefined>(KIND.requiresTitle ? undefined : null);
  useEffect(() => {
    if (!KIND.requiresTitle || !club) return;
    let stop = false;
    void lastTitle(club.id).then((t) => !stop && setTitle(t));
    return () => {
      stop = true;
    };
  }, [KIND.requiresTitle, club]);
  const now = useNow(1000);
  const [tab, setTab] = useState<number | null>(null);

  const total = roundsOf(data ? data.cup.size : KIND.size);
  const mySlot = entry && data && entry.cup_id === data.cup.id ? entry.slot : null;
  const path = useMemo(() => (data && mySlot !== null && now ? pathOf(data, mySlot) : []), [data, mySlot, now]);

  if (!ready || !club) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-white">
        {error ? (
          <>
            <p className="font-bold">{error}</p>
            <button type="button" onClick={() => void reload()} className="btn btn-green">
              Tentar de novo
            </button>
          </>
        ) : (
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
        )}
      </div>
    );
  }

  const ended = data ? now >= new Date(data.cup.ends_at).getTime() : true;
  const started = data ? now >= data.kickoffs[0] : false;
  const live = data ? liveRound(data, now) : null;
  const humans = data ? data.entries.length : 0;
  // fase que o técnico está vendo: a escolhida, a ao vivo, a próxima, ou a final
  const current = data ? (live ?? data.kickoffs.findIndex((k) => now < k) + 1) || total : 1;
  const shown = Math.min(total, Math.max(1, tab ?? current));
  const canJoin = !data || ended;
  const next = now ? nextEditionStart(now, KIND) : null;
  const titleUntil = title ? new Date(title.closed_at).getTime() + TITLE_VALID_DAYS * 86400_000 : 0;
  const noTitle = !!KIND.requiresTitle && title !== undefined && titleUntil <= now;
  const locked = club.division < KIND.minDivision || noTitle;

  // situação do técnico
  let status: ReactNode = null;
  if (data && mySlot !== null) {
    const last = path[path.length - 1];
    const lastKnown = last && scoresKnown(data, last.round, now) && matchDone(last, now);
    const iWon = last && (last.winner === 0 ? last.home.slot : last.away.slot) === mySlot;
    if (!started) {
      status = (
        <>
          <span className="tag bg-[var(--grass)]">Inscrito</span>
          <p className="t-heading mt-2 text-xl">A copa começa {fmtKickoff(data.kickoffs[0]).toLowerCase()}</p>
          <p className="mt-1 text-sm font-bold text-white/75">
            Faltam <span className="t-num text-[var(--sun)]">{fmtCountdown(data.kickoffs[0] - now)}</span> · {humans} {humans === 1 ? "técnico inscrito" : "técnicos inscritos"} ·
            as outras vagas ficam com times da CPU
          </p>
        </>
      );
    } else if (lastKnown && !iWon) {
      status = (
        <>
          <span className="tag bg-[var(--red)] text-white">Eliminado</span>
          <p className="t-heading mt-2 text-xl">{reachLabel(last.round - 1, total)}</p>
          <p className="mt-1 text-sm font-bold text-white/75">
            {last.home.name} {last.result.score[0]} × {last.result.score[1]} {last.away.name}
            {last.shootout ? ` (pênaltis ${last.shootout.score[0]}-${last.shootout.score[1]})` : ""}
          </p>
        </>
      );
    } else if (lastKnown && iWon && last.round === total) {
      status = (
        <>
          <span className="tag bg-[var(--sun)] text-[var(--ink)]">Campeão</span>
          <p className="t-heading mt-2 text-xl">O {club.name} é campeão da {KIND.name}!</p>
        </>
      );
    } else if (last) {
      const s = scoreOf(data, last, now);
      status = (
        <>
          <span className={`tag ${s.status === "vivo" ? "bg-[var(--red)] text-white" : "bg-[var(--sky)]"}`}>
            {s.status === "vivo" ? "Ao vivo" : `Próximo jogo · ${roundName(last.round, total)}`}
          </span>
          {pairsKnown(data, last.round, now) ? (
            <p className="t-heading mt-2 text-xl">
              {last.home.name} {s.status === "vivo" ? s.text.replace("-", " × ") : "×"} {last.away.name}
            </p>
          ) : (
            <p className="t-heading mt-2 text-xl">Adversário sai quando a fase atual terminar</p>
          )}
          <p className="mt-1 text-sm font-bold text-white/75">
            {s.status === "vivo" ? s.clock : `${fmtKickoff(last.kickoff)} · em ${fmtCountdown(last.kickoff - now)}`}
          </p>
          {pairsKnown(data, last.round, now) && (
            <Link href={`/copas/jogo?k=${kind}&r=${last.round}&i=${last.index}`} className="btn btn-paper btn-sm mt-3">
              {s.status === "vivo" ? "Assistir e mexer no time" : "Ver o jogo"}
            </Link>
          )}
        </>
      );
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <ArtImg name={KIND.art} className="h-11 w-11 object-contain" fallback={<Icon name="trophy" className="h-8 w-8 text-[var(--sun)]" />} />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">{KIND.name}</p>
            <p className="truncate text-xs font-bold text-white/60">
              {data && !canJoin ? `Edição #${data.cup.id} · ${live ? `${roundName(live, total)} ao vivo` : started ? roundName(shown, total) : "inscrições abertas"}` : KIND.tagline}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 pb-12 pt-4 sm:px-6">
        {/* as copas do jogo */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CUPS.map((c) => {
            const k = Number(Object.keys(CUP_KINDS).find((x) => CUP_KINDS[Number(x)].id === c.id) ?? -1);
            const open = k >= 0;
            const active = k === kind;
            const cfg = open ? cupConfig(k) : null;
            const lockedHere = cfg ? club.division < cfg.minDivision || (!!cfg.requiresTitle && (k !== kind || noTitle)) : false;
            return (
              <button
                key={c.id}
                type="button"
                disabled={!open}
                onClick={() => open && onPick(k)}
                className={`flex items-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] p-2 text-left ${active ? "bg-[var(--sun)] text-[var(--ink)]" : open ? "bg-white/15 text-white" : "bg-white/10 text-white/60"}`}
                aria-current={active ? "page" : undefined}
              >
                <ArtImg name={`trophy-${c.id}`} className={`h-9 w-9 shrink-0 object-contain ${open ? "" : "opacity-50 grayscale"}`} fallback={<Icon name="trophy" className="h-7 w-7" />} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold leading-tight">{c.name}</span>
                  <span className="block truncate text-[0.65rem] font-bold leading-tight opacity-75">{!open ? `Em breve · ${c.unlock}` : lockedHere ? c.unlock : "Aberta"}</span>
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="rounded-xl bg-[var(--red)] px-3 py-2 text-sm font-bold text-white">{error}</p>}

        {/* resultado da última edição */}
        {data && ended && entry && entry.cup_id === data.cup.id && entry.reach !== null && (
          <Panel className="flex items-center gap-3 !bg-[var(--sun)] !text-[var(--ink)]">
            <Icon name="trophy" className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wider opacity-70">Sua última {KIND.name}</p>
              <p className="t-heading text-lg">{reachLabel(entry.reach, total)}</p>
            </div>
            {(entry.coins ?? 0) > 0 && <span className="t-num shrink-0 text-lg">+{entry.coins} moedas</span>}
          </Panel>
        )}

        {/* inscrição */}
        {canJoin && locked ? (
          <Panel>
            <span className="tag bg-white/15">Bloqueada</span>
            {noTitle ? (
              <>
                <p className="t-heading mt-2 text-xl">A {KIND.name} é só para campeões</p>
                <p className="mt-1 text-sm text-white/75">
                  Termine a temporada em 1º lugar na sua divisão — qualquer divisão, da Várzea às Lendas — para ganhar vaga. O título vale por{" "}
                  {TITLE_VALID_DAYS} dias.
                  {title ? ` O último título do ${club.name} já passou desse prazo.` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="t-heading mt-2 text-xl">
                  A {KIND.name} é {KIND.minDivision >= 5 ? "só para a" : "a partir da"} {divisionInfo(KIND.minDivision).name}
                </p>
                <p className="mt-1 text-sm text-white/75">
                  O {club.name} está na {divisionInfo(club.division).name}. Suba na liga para disputar — enquanto isso, a Copa da Várzea está aberta todo dia.
                </p>
              </>
            )}
            {kind !== 0 && (
              <button type="button" onClick={() => onPick(0)} className="btn btn-paper btn-sm mt-3">
                Ver a Copa da Várzea
              </button>
            )}
          </Panel>
        ) : canJoin ? (
          <Panel>
            <p className="t-heading text-xl">Inscreva o {club.name}</p>
            {KIND.requiresTitle && title && (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--sun)] px-2 py-0.5 text-xs font-extrabold text-[var(--ink)]">
                <Icon name="trophy" className="h-3.5 w-3.5" /> Campeão da {divisionInfo(title.division).name} · vaga garantida até {fmtKickoff(titleUntil)}
              </p>
            )}
            <p className="mt-1 text-sm text-white/75">
              Próxima edição: <b className="text-[var(--sun)]">{next ? fmtKickoff(next) : "..."}</b>. {KIND.weekday === undefined
                ? `Inscrições até ${hhmm(KIND.deadlineMinute)} de cada dia; depois disso, a inscrição vale para a copa do dia seguinte.`
                : `Inscrições até ${hhmm(KIND.deadlineMinute)} de ${WEEKDAYS[KIND.weekday]}; depois disso, a inscrição vale para a semana seguinte.`}
            </p>
            <button type="button" onClick={() => void join()} disabled={joining} className="btn btn-green mt-3">
              <Icon name="trophy" className="h-5 w-5" /> {joining ? "Inscrevendo..." : "Inscrever na copa"}
            </button>
          </Panel>
        ) : (
          status && <Panel>{status}</Panel>
        )}

        {/* chaveamento */}
        {data && (
          <section className="overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
            <div className="flex gap-1 overflow-x-auto bg-[var(--ink)] p-2" role="tablist">
              {Array.from({ length: total }, (_, k) => k + 1).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={shown === r}
                  onClick={() => setTab(r)}
                  className={`h-9 shrink-0 rounded-lg px-3 text-xs font-extrabold sm:text-sm ${shown === r ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white/80"}`}
                >
                  {roundName(r, total)}
                  {live === r && <Icon name="dot" className="ml-1 inline h-2.5 w-2.5 text-[var(--red)]" />}
                </button>
              ))}
            </div>
            <p className="border-b border-[var(--ink)]/10 px-3 py-1.5 text-center text-xs font-bold opacity-70">
              {fmtKickoff(data.kickoffs[shown - 1])}
              {roundOver(data, shown, now) ? " · encerrada" : ""}
            </p>
            {pairsKnown(data, shown, now) ? (
              Array.from({ length: slotsIn(data, shown).length / 2 }, (_, i) => <MatchLine key={i} data={data} m={cupMatch(data, shown, i)} now={now} mySlot={mySlot} />)
            ) : (
              <p className="px-4 py-8 text-center text-sm font-bold opacity-60">
                Os confrontos da {roundName(shown, total).toLowerCase()} saem quando a fase anterior terminar.
              </p>
            )}
          </section>
        )}

        {/* regras e prêmios */}
        <Panel>
          <p className="t-heading">Como funciona</p>
          <ul className="mt-2 space-y-1.5 text-sm text-white/80">
            <li className="flex gap-2">
              <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> {KIND.weekday === undefined ? "Todo dia" : `Todo ${WEEKDAYS[KIND.weekday]}`}, mata-mata de{" "}
              {KIND.size} clubes:{" "}
              {Array.from({ length: total }, (_, k) => `${roundName(k + 1, total).toLowerCase()} às ${hhmm(KIND.firstMinute + k * 120)}`).join(", ")} (Brasília).
              {KIND.minDivision >= 5 && ` Só clubes da ${divisionInfo(KIND.minDivision).name}; as vagas livres ficam com a CPU das Lendas.`}
              {KIND.minDivision > 0 && KIND.minDivision < 5 && ` Só clubes da ${divisionInfo(KIND.minDivision).name} para cima; as vagas livres ficam com a CPU da ${divisionInfo(KIND.botDivision).name}.`}
              {KIND.requiresTitle && ` Só campeões de divisão (1º lugar numa temporada dos últimos ${TITLE_VALID_DAYS} dias); as vagas livres ficam com a CPU da ${divisionInfo(KIND.botDivision).name}.`}
            </li>
            <li className="flex gap-2">
              <Icon name="whistle" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> Jogo único em campo neutro. Empatou, vai para os pênaltis. Dá para mexer no time ao vivo, como na liga.
            </li>
            <li className="flex gap-2">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> Seu time entra com a força da inscrição; vale a escalação salva no apito de cada jogo.
            </li>
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[0.68rem] font-extrabold sm:grid-cols-6">
            {KIND.prizes
              .map((v, reach) => [reach === total ? "Campeão" : reach === total - 1 ? "Vice" : roundName(reach + 1, total).replace("Semifinal", "Semi"), v] as const)
              .filter(([, v]) => v > 0)
              .reverse()
              .map(([label, v]) => (
              <div key={label} className="rounded-lg bg-white/10 px-1 py-1.5">
                <p className="opacity-70">{label}</p>
                <p className="t-num text-sm text-[var(--sun)]">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-1 text-center text-[0.68rem] font-bold text-white/50">moedas por fase alcançada (a copa não dá XP)</p>
        </Panel>
      </div>
    </div>
  );
}
