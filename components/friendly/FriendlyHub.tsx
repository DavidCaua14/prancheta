"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { decodeCrest } from "@/lib/club/identity";
import {
  acceptFriendly,
  ACCEPT_UNTIL_MS,
  createFriendly,
  friendlyError,
  friendlyMatch,
  friendlyState,
  getInvite,
  inviteLink,
  inviteText,
  leaveFriendly,
  loadFriendlies,
  MAX_AHEAD_MS,
  MAX_OPEN,
  MIN_AHEAD_MS,
  myFriendlies,
  type FriendlyData,
  type FriendlyInvite,
  PENDING_INVITE,
  type FriendlyListRow,
  type FriendlyRow,
} from "@/lib/friendly/data";
import { fmtCountdown, fmtKickoff, TICK_SECONDS } from "@/lib/league/core";
import { useNow } from "@/lib/league/useLeague";


function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] ${className}`}>{children}</section>;
}

/* --------------------------------------------------------- horários */

const BRT = 3 * 3600_000; // Brasília = UTC-3 (sem horário de verão desde 2019)

/** Dia (meia-noite em Brasília, em ms UTC) e minutos do dia em Brasília. */
function brt(ms: number) {
  const local = ms - BRT;
  const day = Math.floor(local / 86400_000) * 86400_000;
  return { day: day + BRT, minutes: Math.floor((local - day) / 60_000) };
}

function dayLabel(dayMs: number, today: number) {
  const diff = Math.round((dayMs - today) / 86400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return new Date(dayMs + 12 * 3600_000).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

const QUICK = [
  { label: "Em 5 min", ms: 5 * 60_000 },
  { label: "Em 15 min", ms: 15 * 60_000 },
  { label: "Em 1 hora", ms: 3600_000 },
];

/* -------------------------------------------------------------- tela */

export function FriendlyHub() {
  const router = useRouter();
  const now = useNow(1000);
  const [club, setClub] = useState<Club | null>(null);
  const [rows, setRows] = useState<FriendlyListRow[] | null>(null);
  const [games, setGames] = useState<Record<number, FriendlyData>>({});
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    const s = await getSession();
    const c = new URLSearchParams(window.location.search).get("c");
    if (!s) {
      if (c) {
        try {
          localStorage.setItem(PENDING_INVITE, `/amistosos?c=${encodeURIComponent(c)}`);
        } catch {}
      }
      return router.replace("/entrar");
    }
    const me = await getMyClub(s);
    if (!me || !me.squad) {
      if (c) {
        try {
          localStorage.setItem(PENDING_INVITE, `/amistosos?c=${encodeURIComponent(c)}`);
        } catch {}
      }
      return router.replace(!me ? "/clube/novo" : "/peneira");
    }
    setClub(me);
    setCode(c ? c.toUpperCase() : null);
    try {
      const list = await myFriendlies(me.id);
      setRows(list);
      // placares: só dos jogos que já acabaram (e lidos depois do apito final)
      const ended = list.filter((f) => f.guest && Date.now() > new Date(f.kickoff).getTime() + 100 * TICK_SECONDS * 1000);
      const data = await loadFriendlies(ended.slice(0, 10));
      setGames(Object.fromEntries(data.map((d) => [d.f.id, d])));
      setError(null);
    } catch {
      setError("Não deu para carregar os amistosos. Tente de novo em instantes.");
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona
    void load();
  }, [load]);

  // próximo apito ou fim de jogo com a tela aberta: relê a lista
  useEffect(() => {
    if (!rows) return;
    const t = Date.now();
    const moments = rows
      .filter((f) => f.guest)
      .flatMap((f) => {
        const k = new Date(f.kickoff).getTime();
        return [k + 1_000, k + 100 * TICK_SECONDS * 1000 + 2_000];
      })
      .filter((m) => m > t && m - t < 6 * 3600_000);
    if (!moments.length) return;
    const id = window.setTimeout(() => void load(), Math.min(...moments) - t);
    return () => window.clearTimeout(id);
  }, [rows, load]);

  const closeInvite = useCallback(() => {
    setCode(null);
    window.history.replaceState(null, "", "/amistosos");
  }, []);

  if (!club || !rows) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const open = rows.filter((f) => new Date(f.kickoff).getTime() > now - 15 * 60_000).length;
  const upcoming = rows.filter((f) => friendlyState(f, now) !== "done" && friendlyState(f, now) !== "expired").sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const past = rows.filter((f) => friendlyState(f, now) === "done");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <ArtImg name="icon-pvp" className="h-11 w-11 object-contain" fallback={<Icon name="whistle" className="h-8 w-8 text-[var(--sun)]" />} />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Amistosos</p>
            <p className="truncate text-xs font-bold text-white/60">Desafie seus amigos · vale a resenha, não vale moeda</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 px-3 pb-12 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {error && <p className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--red)] px-3 py-2 text-sm font-bold text-white">{error}</p>}
          {code && <InviteCard code={code} club={club} now={now} onDone={closeInvite} onAccepted={load} />}
          <CreatePanel club={club} now={now} full={open >= MAX_OPEN} onCreated={load} onToast={setToast} />

          <Panel>
            <p className="t-heading">Próximos jogos</p>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-white/70">Nenhum amistoso marcado. Crie um convite e mande no grupo!</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {upcoming.map((f) => (
                  <UpcomingRow key={f.id} f={f} club={club} now={now} onChanged={load} onToast={setToast} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <p className="t-heading">Resultados</p>
            {past.length === 0 ? (
              <p className="mt-2 text-sm text-white/70">Os amistosos jogados aparecem aqui.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {past.map((f) => (
                  <ResultRow key={f.id} f={f} data={games[f.id]} clubId={club.id} />
                ))}
              </ul>
            )}
          </Panel>
          <CodePanel onCode={(c) => {
            window.history.replaceState(null, "", `/amistosos?c=${encodeURIComponent(c)}`);
            setCode(c);
          }} />
          <Panel>
            <p className="t-heading">Como funciona</p>
            <ul className="mt-2 space-y-1.5 text-sm text-white/80">
              <li className="flex gap-2">
                <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> Escolha o horário (de 2 minutos a 7 dias) e mande o link para o seu amigo aceitar.
              </li>
              <li className="flex gap-2">
                <Icon name="whistle" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> No horário, o jogo é ao vivo (cerca de 10 minutos): mexa na tática e faça substituições, como na liga.
              </li>
              <li className="flex gap-2">
                <Icon name="clipboard" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> Vale a escalação salva no apito. A força das cartas fica congelada no aceite. Quem convida joga em casa.
              </li>
              <li className="flex gap-2">
                <Icon name="star" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sun)]" /> Amistoso não dá moedas nem XP — é só pela resenha. Até {MAX_OPEN} jogos marcados por vez.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      {toast && (
        <div role="status" className="anim-pop fixed inset-x-3 bottom-4 z-50 mx-auto max-w-sm rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-4 py-2.5 text-center text-sm font-extrabold text-[var(--ink)] shadow-[0_4px_0_var(--ink)]">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ compartilhar */

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function ShareButtons({ code, clubName, kickoff, onToast, compact = false }: { code: string; clubName: string; kickoff: number; onToast: (t: string) => void; compact?: boolean }) {
  const link = inviteLink(window.location.origin, code);
  const text = inviteText(clubName, fmtKickoff(kickoff), link);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-3"}`}>
      <button type="button" className="btn btn-paper btn-sm" onClick={async () => onToast((await copy(link)) ? "Link copiado!" : "Não deu para copiar. Copie o código.")}>
        <Icon name="copy" className="h-4 w-4" /> Copiar link
      </button>
      <a className="btn btn-green btn-sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
        <Icon name="share" className="h-4 w-4" /> WhatsApp
      </a>
      {canShare && !compact && (
        <button type="button" className="btn btn-paper btn-sm" onClick={() => void navigator.share({ title: "Amistoso na Prancheta", text, url: link }).catch(() => {})}>
          Mais opções
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- marcar */

function CreatePanel({ club, now, full, onCreated, onToast }: { club: Club; now: number; full: boolean; onCreated: () => Promise<void> | void; onToast: (t: string) => void }) {
  const [base] = useState(() => Date.now());
  const { day: today, minutes: nowMin } = brt(now || base);
  // dia + hora (Brasília); padrão: hoje, na próxima hora cheia com folga
  const [dayIdx, setDayIdx] = useState(nowMin >= 22 * 60 ? 1 : 0);
  const [time, setTime] = useState(() => {
    const m = Math.min(23 * 60 + 30, Math.ceil((nowMin + 20) / 30) * 30);
    return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  });
  const [quick, setQuick] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<{ code: string; kickoff: number } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => today + i * 86400_000), [today]);
  const [hh, mm] = time.split(":").map(Number);
  const kickoff = quick !== null ? Math.ceil((now + QUICK[quick].ms) / 60_000) * 60_000 : days[dayIdx] + (hh * 60 + mm) * 60_000;
  const valid = Number.isFinite(kickoff) && kickoff >= now + MIN_AHEAD_MS && kickoff <= now + MAX_AHEAD_MS;

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const code = await createFriendly(kickoff);
      setMade({ code, kickoff });
      await onCreated();
    } catch (e) {
      setErr(friendlyError(e));
    }
    setBusy(false);
  }

  if (made) {
    return (
      <Panel className="!bg-[var(--hot)]">
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.15em] text-white/80">Convite de amistoso</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 flex-col items-center">
            <CrestSvg crest={decodeCrest(club.crest)} tag={club.tag} className="h-16 w-14" />
            <strong className="mt-1 max-w-full truncate text-sm">{club.name}</strong>
          </div>
          <span className="t-display text-3xl text-[var(--sun)]">VS</span>
          <div className="flex flex-col items-center">
            <div className="t-display flex h-16 w-14 items-center justify-center rounded-2xl border-[3px] border-dashed border-[var(--ink)] bg-[var(--cream)] text-3xl text-[var(--ink)] [text-shadow:none]">?</div>
            <strong className="mt-1 text-sm">Seu amigo</strong>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border-[3px] border-[var(--ink)] bg-white p-1.5 pl-3 text-[var(--ink)]">
          <span className="t-num min-w-0 flex-1 truncate text-lg">{made.code}</span>
        </div>
        <p className="mt-2 text-center text-sm font-bold text-white/90">{fmtKickoff(made.kickoff)} · Estádio do {club.name}</p>
        <ShareButtons code={made.code} clubName={club.name} kickoff={made.kickoff} onToast={onToast} />
        <button type="button" className="mt-3 text-sm font-bold text-white/80 underline" onClick={() => setMade(null)}>
          Marcar outro amistoso
        </button>
      </Panel>
    );
  }

  return (
    <Panel>
      <p className="t-heading text-lg">Marcar amistoso</p>
      <p className="mt-1 text-sm text-white/70">Escolha quando vai ser o jogo. Você recebe um link para mandar no grupo.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Quando">
        {QUICK.map((q, i) => (
          <button
            key={q.label}
            type="button"
            role="radio"
            aria-checked={quick === i}
            onClick={() => setQuick(i)}
            className={`rounded-xl border-[3px] border-[var(--ink)] px-3 py-1.5 text-sm font-extrabold ${quick === i ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white"}`}
          >
            {q.label}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={quick === null}
          onClick={() => setQuick(null)}
          className={`rounded-xl border-[3px] border-[var(--ink)] px-3 py-1.5 text-sm font-extrabold ${quick === null ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white"}`}
        >
          Escolher dia e hora
        </button>
      </div>
      {quick === null && (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-white/70">
            Dia
            <select value={dayIdx} onChange={(e) => setDayIdx(Number(e.target.value))} className="h-11 rounded-xl border-[3px] border-[var(--ink)] bg-white px-2 text-sm font-bold text-[var(--ink)]">
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {dayLabel(d, today)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-white/70">
            Hora (Brasília)
            <input type="time" value={time} step={300} onChange={(e) => e.target.value && setTime(e.target.value)} className="h-11 rounded-xl border-[3px] border-[var(--ink)] bg-white px-2 text-sm font-bold text-[var(--ink)]" />
          </label>
        </div>
      )}
      <p className="mt-3 text-sm text-white/80">
        Jogo: <b className="text-[var(--sun)]">{Number.isFinite(kickoff) ? fmtKickoff(kickoff) : "—"}</b>
        {!valid && Number.isFinite(kickoff) && <span className="text-[var(--orange)]"> · escolha entre 2 minutos e 7 dias a partir de agora</span>}
      </p>
      {full && <p className="mt-2 text-sm font-bold text-[var(--orange)]">Você já tem {MAX_OPEN} amistosos marcados. Jogue ou cancele um para marcar outro.</p>}
      {err && <p className="mt-2 text-sm font-bold text-[var(--orange)]">{err}</p>}
      <button type="button" disabled={busy || !valid || full} onClick={() => void create()} className="btn btn-green mt-3 disabled:opacity-50">
        <Icon name="share" className="h-5 w-5" /> {busy ? "Criando..." : "Criar convite"}
      </button>
    </Panel>
  );
}

/* ------------------------------------------------------------ convite */

function InviteCard({ code, club, now, onDone, onAccepted }: { code: string; club: Club; now: number; onDone: () => void; onAccepted: () => Promise<void> | void }) {
  const router = useRouter();
  const [inv, setInv] = useState<FriendlyInvite | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    getInvite(code)
      .then((i) => !stop && setInv(i))
      .catch(() => !stop && setInv(null));
    return () => {
      stop = true;
    };
  }, [code]);

  if (inv === undefined) {
    return (
      <Panel>
        <p className="text-sm text-white/70">Abrindo o convite {code}...</p>
      </Panel>
    );
  }
  if (inv === null) {
    return (
      <Panel>
        <p className="t-heading">Convite não encontrado</p>
        <p className="mt-1 text-sm text-white/70">Confira o código {code} com quem mandou — ele pode ter sido cancelado.</p>
        <button type="button" onClick={onDone} className="btn btn-paper btn-sm mt-3">
          Fechar
        </button>
      </Panel>
    );
  }

  const k = new Date(inv.kickoff).getTime();
  const mine = inv.host === club.id;
  const iAmGuest = inv.guest === club.id;
  const taken = !!inv.guest && !iAmGuest;
  const late = now > k - ACCEPT_UNTIL_MS;

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const id = await acceptFriendly(code);
      await onAccepted();
      if (Date.now() > k - 60_000) router.push(`/amistosos/jogo?id=${id}`);
      else {
        setInv((i) => (i ? { ...i, guest: club.id, guest_name: club.name, guest_tag: club.tag } : i));
      }
    } catch (e) {
      setErr(friendlyError(e));
    }
    setBusy(false);
  }

  return (
    <Panel className="!bg-[var(--hot)]">
      <p className="text-center text-xs font-extrabold uppercase tracking-[0.15em] text-white/80">Convite de amistoso · {code}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center">
          <CrestSvg crest={decodeCrest(inv.host_crest)} tag={inv.host_tag} className="h-16 w-14" />
          <strong className="mt-1 max-w-full truncate text-sm">{inv.host_name}</strong>
        </div>
        <span className="t-display text-3xl text-[var(--sun)]">VS</span>
        <div className="flex min-w-0 flex-col items-center">
          {inv.guest && !iAmGuest ? (
            <div className="t-display flex h-16 w-14 items-center justify-center rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--cream)] text-lg text-[var(--ink)] [text-shadow:none]">{inv.guest_tag}</div>
          ) : mine ? (
            <div className="t-display flex h-16 w-14 items-center justify-center rounded-2xl border-[3px] border-dashed border-[var(--ink)] bg-[var(--cream)] text-3xl text-[var(--ink)] [text-shadow:none]">?</div>
          ) : (
            <CrestSvg crest={decodeCrest(club.crest)} tag={club.tag} className="h-16 w-14" />
          )}
          <strong className="mt-1 max-w-full truncate text-sm">{inv.guest && !iAmGuest ? inv.guest_name : mine ? "Seu amigo" : club.name}</strong>
        </div>
      </div>
      <p className="mt-3 text-center text-sm font-bold text-white/90">
        {fmtKickoff(k)} · Estádio do {inv.host_name}
      </p>
      {mine ? (
        <p className="mt-3 text-center text-sm font-bold">Esse convite é seu — mande o link para um amigo aceitar.</p>
      ) : iAmGuest ? (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-center text-sm font-extrabold">Jogo marcado! {now < k ? `Começa em ${fmtCountdown(k - now)}.` : ""}</p>
          <Link href={`/amistosos/jogo?id=${inv.id}`} className="btn btn-paper btn-sm">
            {now < k ? "Ver o jogo" : "Assistir e mexer no time"}
          </Link>
        </div>
      ) : taken ? (
        <p className="mt-3 text-center text-sm font-bold">Outro técnico já aceitou esse convite.</p>
      ) : late ? (
        <p className="mt-3 text-center text-sm font-bold">O convite expirou: o horário do jogo já chegou.</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void accept()} className="btn btn-green disabled:opacity-50">
            <Icon name="check" className="h-5 w-5" /> {busy ? "Aceitando..." : "Aceitar o desafio"}
          </button>
          <p className="text-center text-xs font-bold text-white/80">Começa em {fmtCountdown(k - now)}. Ajuste a escalação antes do apito!</p>
        </div>
      )}
      {err && <p className="mt-2 text-center text-sm font-bold text-[var(--sun)]">{err}</p>}
      <div className="mt-3 text-center">
        <button type="button" onClick={onDone} className="text-sm font-bold text-white/80 underline">
          Fechar convite
        </button>
      </div>
    </Panel>
  );
}

function CodePanel({ onCode }: { onCode: (c: string) => void }) {
  const [v, setV] = useState("");
  const clean = v.trim().toUpperCase().replace(/^.*[?&]C=/, "").replace(/[^A-Z0-9-]/g, "");
  return (
    <Panel>
      <p className="t-heading">Recebeu um código?</p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean.length >= 6) onCode(clean);
        }}
      >
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="RESENHA-7K2Q"
          aria-label="Código do convite"
          autoCapitalize="characters"
          className="h-11 min-w-0 flex-1 rounded-xl border-[3px] border-[var(--ink)] bg-white px-3 font-bold uppercase text-[var(--ink)] placeholder:normal-case placeholder:text-[var(--ink)]/35"
        />
        <button type="submit" disabled={clean.length < 6} className="btn btn-paper btn-sm shrink-0 disabled:opacity-50">
          Abrir
        </button>
      </form>
    </Panel>
  );
}

/* ---------------------------------------------------------- listas */

function UpcomingRow({ f, club, now, onChanged, onToast }: { f: FriendlyListRow; club: Club; now: number; onChanged: () => Promise<void> | void; onToast: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const st = friendlyState(f, now);
  const k = new Date(f.kickoff).getTime();
  const host = f.host === club.id;
  const rival = host ? f.g : f.h;

  async function leave() {
    if (!window.confirm(host ? "Cancelar esse amistoso?" : "Desistir desse amistoso?")) return;
    setBusy(true);
    try {
      await leaveFriendly(f.id);
      await onChanged();
      onToast(host ? "Amistoso cancelado." : "Você saiu do amistoso.");
    } catch {
      onToast("Não deu certo. Tente de novo.");
    }
    setBusy(false);
  }

  return (
    <li className="rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)]">
      <div className="flex items-center gap-2">
        {rival && <CrestSvg crest={decodeCrest(rival.crest)} tag={rival.tag} className="h-9 w-8 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">
            {st === "waiting" ? "Esperando um amigo aceitar" : `${host ? "Contra o" : "Visita ao"} ${rival?.name ?? "adversário"}`}
          </p>
          <p className="t-num text-xs opacity-70">
            {fmtKickoff(k)} · {st === "live" ? "ao vivo" : `começa em ${fmtCountdown(k - now)}`} · {f.code}
          </p>
        </div>
        {st === "live" ? (
          <Link href={`/amistosos/jogo?id=${f.id}`} className="btn btn-green btn-sm shrink-0">
            Assistir
          </Link>
        ) : st === "scheduled" ? (
          <Link href={`/amistosos/jogo?id=${f.id}`} className="btn btn-paper btn-sm shrink-0">
            Ver
          </Link>
        ) : null}
      </div>
      {st === "waiting" && <ShareButtons code={f.code} clubName={club.name} kickoff={k} onToast={onToast} compact />}
      {(st === "waiting" || st === "scheduled") && (
        <button type="button" disabled={busy} onClick={() => void leave()} className="mt-2 text-xs font-extrabold text-[var(--red)] underline disabled:opacity-50">
          {host ? "Cancelar amistoso" : "Desistir"}
        </button>
      )}
    </li>
  );
}

function ResultRow({ f, data, clubId }: { f: FriendlyRow; data?: FriendlyData; clubId: string }) {
  const m = data ? friendlyMatch(data) : null;
  const side = f.host === clubId ? 0 : 1;
  const [h, a] = m ? m.result.score : [0, 0];
  const mine = side === 0 ? h : a;
  const theirs = side === 0 ? a : h;
  const tone = !m ? "bg-white/15" : mine > theirs ? "bg-[var(--grass)] text-[var(--ink)]" : mine < theirs ? "bg-[var(--red)] text-white" : "bg-[var(--sun)] text-[var(--ink)]";
  return (
    <li>
      <Link href={`/amistosos/jogo?id=${f.id}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-2 py-2 text-[var(--ink)] hover:bg-[var(--cream)]">
        {m ? (
          <>
            <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
              <span className="truncate text-sm font-bold">{m.home.name}</span>
              <CrestSvg crest={m.home.crest} tag={m.home.tag} className="h-7 w-6 shrink-0" />
            </span>
            <span className={`t-num rounded-md px-2 text-base leading-tight ${tone}`}>
              {h}-{a}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <CrestSvg crest={m.away.crest} tag={m.away.tag} className="h-7 w-6 shrink-0" />
              <span className="truncate text-sm font-bold">{m.away.name}</span>
            </span>
          </>
        ) : (
          <span className="col-span-3 text-center text-sm font-bold">{fmtKickoff(new Date(f.kickoff).getTime())} · ver o jogo</span>
        )}
      </Link>
    </li>
  );
}
