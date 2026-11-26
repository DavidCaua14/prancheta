"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { Icon } from "@/components/ui/Icon";
import {
  checkAdmin,
  forceClose,
  grantCoins,
  loadCompetitions,
  loadLog,
  loadOnline,
  loadOverview,
  loadUser,
  loadUsers,
  renameClub,
  setBan,
  type Competitions,
  type DayPoint,
  type LogRow,
  type OnlineRow,
  type Overview,
  type UserDetail,
  type UserRow,
  type UserSort,
} from "@/lib/admin";
import { getSession } from "@/lib/club/api";
import { decodeCrest } from "@/lib/club/identity";
import { cupConfig, roundName, roundsOf } from "@/lib/cup/core";
import { divisionInfo } from "@/lib/league/divisions";

/* ------------------------------------------------------------ ajudantes */

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

function ago(s: string | null | undefined) {
  if (!s) return "nunca";
  const sec = Math.max(0, (Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 60) return "agora";
  if (sec < 3600) return `há ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `há ${Math.floor(sec / 3600)} h`;
  return `há ${Math.floor(sec / 86400)} d`;
}

function bytes(n: number) {
  return n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(1)} GB` : `${Math.round(n / (1 << 20))} MB`;
}

const SCREENS: [string, string][] = [
  ["/admin", "Painel admin"],
  ["/jogo", "Sede"],
  ["/liga", "Liga"],
  ["/partida", "Partida"],
  ["/copas/jogo", "Jogo de copa"],
  ["/copas", "Copas"],
  ["/leilao", "Leilão"],
  ["/escalacao", "Escalação"],
  ["/eventos", "Eventos"],
  ["/ranking", "Ranking"],
  ["/amistosos", "Amistosos"],
  ["/loja", "Loja"],
  ["/peneira", "Peneira"],
  ["/clube/novo", "Criando clube"],
  ["/entrar", "Login"],
];
const screenName = (p: string | null) => (!p ? "—" : p === "/" ? "Página inicial" : (SCREENS.find(([k]) => p.startsWith(k))?.[1] ?? p));
const online = (s: string | null | undefined) => !!s && Date.now() - new Date(s).getTime() < 120_000;

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

function Stat({ label, value, sub, tone = "" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={`min-w-0 rounded-2xl border-[3px] border-[var(--ink)] p-3 ${tone || "bg-white/10"}`}>
      <p className="truncate text-[0.68rem] font-extrabold uppercase tracking-wider opacity-70">{label}</p>
      <p className="t-num mt-0.5 truncate text-2xl leading-tight">{value}</p>
      {sub && <p className="truncate text-xs font-bold opacity-70">{sub}</p>}
    </div>
  );
}

function Crest({ crest, tag, className = "h-9 w-8" }: { crest: string | null; tag: string | null; className?: string }) {
  if (!crest) return <span className={`flex shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-extrabold text-white/50 ${className}`}>?</span>;
  return <CrestSvg crest={decodeCrest(crest)} tag={tag ?? ""} className={`shrink-0 ${className}`} />;
}

function Dot({ on }: { on: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[var(--ink)] ${on ? "bg-[var(--grass)]" : "bg-white/25"}`} aria-label={on ? "online" : "offline"} />;
}

/** Barras por dia (uma série só: o título diz o que é). Passar o mouse/tocar mostra o valor. */
function DayBars({ data, pick, label }: { data: DayPoint[]; pick: (d: DayPoint) => number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = data.map(pick);
  const max = Math.max(1, ...vals);
  const W = 280;
  const H = 96;
  const gap = 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const h = hover ?? data.length - 1;
  const day = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm font-extrabold">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-xs font-bold text-white/70">
          {data[h] ? `${day(data[h].day)}: ` : ""}
          <span className="t-num text-sm text-white">{fmt(vals[h])}</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-2 w-full" role="img" aria-label={`${label}, últimos ${data.length} dias`} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H} y2={H} stroke="rgba(255,255,255,.25)" strokeWidth={1} />
        {vals.map((v, i) => {
          const x = i * (bw + gap);
          const bh = v ? Math.max(3, (v / max) * (H - 4)) : 0;
          const r = Math.min(4, bw / 2, bh);
          const y = H - bh;
          return (
            <g key={data[i].day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H} Z`}
                  fill={i === h ? "var(--sun)" : "var(--grass)"}
                />
              )}
            </g>
          );
        })}
        <text x={0} y={H + 12} fill="rgba(255,255,255,.6)" fontSize={9} fontWeight={700}>
          {data[0] ? day(data[0].day) : ""}
        </text>
        <text x={W} y={H + 12} fill="rgba(255,255,255,.6)" fontSize={9} fontWeight={700} textAnchor="end">
          hoje
        </text>
      </svg>
      <table className="sr-only">
        <tbody>
          {data.map((d, i) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{vals[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ---------------------------------------------------------------- tela */

type Tab = "geral" | "online" | "usuarios" | "competicoes" | "registro";
const TABS: [Tab, string][] = [
  ["geral", "Visão geral"],
  ["online", "Online"],
  ["usuarios", "Usuários"],
  ["competicoes", "Competições"],
  ["registro", "Registro"],
];

export function AdminPanel() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("geral");
  const [open, setOpen] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      // sempre confere no banco (o banco também confere em cada consulta)
      setAllowed(await checkAdmin(s.user.id, { fresh: true }));
    })();
  }, [router]);

  if (allowed === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <Icon name="shield" className="h-12 w-12 text-[var(--sun)]" />
        <p className="t-heading text-xl">Área restrita</p>
        <p className="text-sm text-white/75">Esta tela é só para a administração do Prancheta.</p>
        <Link href="/jogo" className="btn btn-paper btn-sm">
          Voltar ao jogo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--hot)]">
            <Icon name="shield" className="h-6 w-6 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Painel admin</p>
            <p className="truncate text-xs font-bold text-white/60">Visão de bastidores do Prancheta</p>
          </div>
          {onlineCount !== null && (
            <button type="button" onClick={() => setTab("online")} className="flex shrink-0 items-center gap-1.5 rounded-xl border-[3px] border-[var(--ink)] bg-[var(--grass)] px-2.5 py-1 text-[var(--ink)]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--ink)]" />
              <span className="t-num text-lg leading-none">{onlineCount}</span>
              <span className="hidden text-xs font-extrabold sm:inline">online</span>
            </button>
          )}
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 sm:px-6" role="tablist">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-9 shrink-0 rounded-xl px-3 text-sm font-extrabold ${tab === id ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white/80"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-3 pb-16 pt-4 sm:px-6">
        {tab === "geral" && <OverviewTab onOnline={setOnlineCount} go={setTab} />}
        {tab === "online" && <OnlineTab onOpen={setOpen} onCount={setOnlineCount} />}
        {tab === "usuarios" && <UsersTab onOpen={setOpen} />}
        {tab === "competicoes" && <CompetitionsTab />}
        {tab === "registro" && <LogTab onOpen={setOpen} />}
      </div>

      {open && <UserSheet id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Lê ao abrir e a cada `ms` com a aba visível. */
function usePoll<T>(load: () => Promise<T>, ms: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [at, setAt] = useState(0);
  const run = useCallback(async () => {
    try {
      setData(await load());
      setError(false);
      setAt(Date.now());
    } catch {
      setError(true);
    }
  }, [load]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura assíncrona do painel
    void run();
    const id = window.setInterval(() => document.visibilityState === "visible" && void run(), ms);
    return () => window.clearInterval(id);
  }, [run, ms]);
  return { data, error, at, reload: run };
}

function Refresh({ at, onClick }: { at: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-extrabold text-white/80 hover:bg-white/15">
      <Icon name="restart" className="h-3.5 w-3.5" />
      {at ? new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "..."}
    </button>
  );
}

function Loading({ error }: { error: boolean }) {
  return error ? (
    <p className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--red)] px-3 py-2 text-sm font-bold text-white">Não deu para carregar. Tentando de novo...</p>
  ) : (
    <p className="p-4 text-sm text-white/70">Carregando...</p>
  );
}

/* ------------------------------------------------------------ visão geral */

function OverviewTab({ onOnline, go }: { onOnline: (n: number) => void; go: (t: Tab) => void }) {
  const { data: o, error, at, reload } = usePoll<Overview>(loadOverview, 30_000);
  useEffect(() => {
    if (o) onOnline(o.users.online);
  }, [o, onOnline]);
  if (!o) return <Loading error={error} />;
  const u = o.users;
  const e = o.economy;
  const h = o.health;
  const issues = h.leagues_overdue.length + h.cups_overdue.length + (h.unscored_rounds > 0 ? 1 : 0);
  const income7 = e.events_7d + e.home_7d + e.league_prizes_7d + e.cup_prizes_7d;
  const maxDiv = Math.max(1, ...o.divisions.map((d) => d.clubs));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 text-white">
        <p className="text-sm font-bold text-white/70">Atualiza sozinho a cada 30 s</p>
        <Refresh at={at} onClick={() => void reload()} />
      </div>

      {/* usuários */}
      <div className="grid grid-cols-2 gap-2 text-white sm:grid-cols-4">
        <button type="button" onClick={() => go("online")} className="text-left">
          <Stat label="Online agora" value={fmt(u.online)} sub="últimos 2 min" tone="bg-[var(--grass)] text-[var(--ink)]" />
        </button>
        <Stat label="Usuários" value={fmt(u.total)} sub={`+${fmt(u.new_24h)} em 24 h · +${fmt(u.new_7d)} em 7 d`} />
        <Stat label="Ativos hoje" value={fmt(u.active_1d)} sub={`${fmt(u.active_7d)} em 7 d · ${fmt(u.active_30d)} em 30 d`} />
        <Stat
          label="Retenção 7 d"
          value={u.total ? `${Math.round((u.active_7d / u.total) * 100)}%` : "—"}
          sub={`${fmt(u.no_club)} sem clube · ${fmt(u.no_squad)} sem elenco`}
        />
      </div>

      {/* saúde */}
      <Panel title="Saúde do jogo" right={<span className={`tag ${issues ? "bg-[var(--red)] text-white" : "bg-[var(--grass)]"}`}>{issues ? `${issues} alerta${issues > 1 ? "s" : ""}` : "Tudo certo"}</span>}>
        <ul className="flex flex-col gap-2 text-sm">
          {h.leagues_overdue.map((l) => (
            <OverdueRow key={`l${l.id}`} text={`Liga #${l.id} (${divisionInfo(l.division).short}) acabou ${ago(l.ends_at)} e não foi fechada`} kind="liga" id={l.id} onDone={reload} />
          ))}
          {h.cups_overdue.map((c) => (
            <OverdueRow key={`c${c.id}`} text={`${cupConfig(c.kind).name} #${c.id} acabou ${ago(c.ends_at)} e não foi fechada`} kind="copa" id={c.id} onDone={reload} />
          ))}
          {h.unscored_rounds > 0 && (
            <li className="flex items-center gap-2 rounded-xl bg-[var(--orange)]/25 px-3 py-2">
              <Icon name="warning" className="h-4 w-4 shrink-0 text-[var(--orange)]" />
              <span>
                {h.unscored_rounds} rodada{h.unscored_rounds > 1 ? "s" : ""} das últimas 48 h ainda sem pontuação no ranking (pontua quando um técnico da liga abre o jogo).
              </span>
            </li>
          )}
          {!issues && (
            <li className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-[var(--grass)]" /> Ligas e copas fechando no horário, ranking em dia.
            </li>
          )}
          <li className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs font-bold text-white/65">
            <span>Banco: {bytes(h.db_size)} (plano grátis: 500 MB)</span>
            <span>Ligas abertas: {fmt(o.play.leagues_open)}</span>
            <span>Copas abertas: {fmt(o.play.cups_open)}</span>
          </li>
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Últimos 14 dias">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DayBars data={o.series} pick={(d) => d.signups} label="Novos cadastros" />
            <DayBars data={o.series} pick={(d) => d.active} label="Jogadores ativos" />
          </div>
        </Panel>

        <Panel title="Atividade nas últimas 24 h">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Jogos pontuados" value={fmt(o.play.matches_24h)} sub="liga + copa, técnicos reais" />
            <Stat label="Mexidas ao vivo" value={fmt(o.play.changes_24h)} sub="táticas e substituições" />
            <Stat label="Escalações salvas" value={fmt(o.play.lineups_24h)} />
            <Stat label="Amistosos" value={fmt(o.play.friendlies_24h)} sub={`${fmt(o.play.friendlies_played_24h)} jogados`} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Economia">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Moedas em circulação" value={fmt(e.coins_total)} sub={`média ${fmt(e.coins_avg)} · maior ${fmt(e.coins_max)}`} />
            <Stat label="Gasto no leilão (24 h)" value={fmt(e.auction_24h)} sub={`${fmt(e.auction_sold_24h)} cartas vendidas`} />
            <Stat label="Leilão agora" value={`${fmt(e.auction_open)} lotes`} sub={`${fmt(e.auction_bids_open)} lances`} />
            <Stat label="Entrou em 7 d" value={fmt(income7)} sub="prêmios, eventos e renda" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
            {(
              [
                ["Eventos", e.events_7d],
                ["Renda em casa", e.home_7d],
                ["Prêmios liga", e.league_prizes_7d],
                ["Prêmios copa", e.cup_prizes_7d],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/10 px-2 py-1">
                <dt className="truncate font-bold text-white/65">{k}</dt>
                <dd className="t-num">{fmt(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-white/60">
            Níveis de estrutura somados: estádio {fmt(e.facilities[0])} · lanchonete {fmt(e.facilities[1])} · loja {fmt(e.facilities[2])}
          </p>
        </Panel>

        <Panel title="Clubes por divisão">
          {o.divisions.length === 0 ? (
            <p className="text-sm text-white/70">Nenhum clube com elenco ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {o.divisions.map((d) => (
                <li key={d.division} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                  <span className="truncate font-bold">{divisionInfo(d.division).short}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-[var(--sky)]" style={{ width: `${(d.clubs / maxDiv) * 100}%` }} />
                  </span>
                  <span className="t-num w-24 text-right text-xs">
                    {fmt(d.clubs)} <span className="text-white/60">· {fmt(Math.round(d.coins / Math.max(1, d.clubs)))} 🪙</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-white/60">Clubes e média de moedas por clube.</p>
        </Panel>
      </div>
    </div>
  );
}

function OverdueRow({ text, kind, id, onDone }: { text: string; kind: "liga" | "copa"; id: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--red)]/25 px-3 py-2">
      <Icon name="warning" className="h-4 w-4 shrink-0 text-[var(--red)]" />
      <span className="min-w-0 flex-1">{text}</span>
      {msg && <span className="text-xs font-bold">{msg}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await forceClose(kind, id);
            setMsg("Fechada!");
            onDone();
          } catch {
            setMsg("Falhou — tente de novo");
          }
          setBusy(false);
        }}
        className="btn btn-paper btn-sm"
      >
        {busy ? "Fechando..." : "Fechar agora"}
      </button>
    </li>
  );
}

/* ---------------------------------------------------------------- online */

function OnlineTab({ onOpen, onCount }: { onOpen: (id: string) => void; onCount: (n: number) => void }) {
  const { data, error, at, reload } = usePoll<OnlineRow[]>(loadOnline, 20_000);
  const now = data ? data.filter((r) => online(r.last_seen)) : [];
  const recent = data ? data.filter((r) => !online(r.last_seen)) : [];
  useEffect(() => {
    if (data) onCount(now.length);
  }, [data, now.length, onCount]);
  if (!data) return <Loading error={error} />;
  const byScreen = Object.entries(
    now.reduce<Record<string, number>>((m, r) => {
      const k = screenName(r.screen);
      m[k] = (m[k] ?? 0) + 1;
      return m;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title={`Online agora · ${now.length}`} right={<Refresh at={at} onClick={() => void reload()} />}>
          <PeopleList rows={now} onOpen={onOpen} empty="Ninguém com o jogo aberto neste momento." />
        </Panel>
        <Panel title={`Vistos nos últimos 15 min · ${recent.length}`}>
          <PeopleList rows={recent} onOpen={onOpen} empty="Ninguém." />
        </Panel>
      </div>
      <Panel title="Onde estão">
        {byScreen.length === 0 ? (
          <p className="text-sm text-white/70">—</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {byScreen.map(([k, n]) => (
              <li key={k} className="flex justify-between gap-2 rounded-lg bg-white/10 px-2 py-1">
                <span className="truncate font-bold">{k}</span>
                <span className="t-num">{n}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-white/60">O app avisa a cada minuto com a aba aberta e visível; some daqui 2 min depois de fechar.</p>
      </Panel>
    </div>
  );
}

function PeopleList({ rows, onOpen, empty }: { rows: OnlineRow[]; onOpen: (id: string) => void; empty: string }) {
  if (!rows.length) return <p className="text-sm text-white/70">{empty}</p>;
  return (
    <ul className="-mx-4 -mb-4">
      {rows.map((r) => (
        <li key={r.id} className="border-t border-white/10">
          <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-white/5">
            <Dot on={online(r.last_seen)} />
            <Crest crest={r.crest} tag={r.tag} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{r.name ?? "Sem clube"}</span>
              <span className="block truncate text-xs font-bold text-white/60">{r.email}</span>
            </span>
            <span className="shrink-0 text-right text-xs font-bold">
              <span className="block">{screenName(r.screen)}</span>
              <span className="block text-white/60">{ago(r.last_seen)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- usuários */

function UsersTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<UserSort>("recent");
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<{ total: number; rows: UserRow[] } | null>(null);
  const [error, setError] = useState(false);
  const PER = 50;

  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(q);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let stop = false;
    loadUsers(query, sort, page * PER, PER)
      .then((r) => {
        if (stop) return;
        setRes(r);
        setError(false);
      })
      .catch(() => !stop && setError(true));
    return () => {
      stop = true;
    };
  }, [query, sort, page]);

  return (
    <Panel className="!p-0">
      <div className="flex flex-col gap-2 border-b-[3px] border-[var(--ink)] p-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por e-mail, clube ou sigla"
          className="h-10 min-w-0 flex-1 rounded-xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-3 text-sm font-bold text-[var(--ink)] outline-none placeholder:text-[var(--ink)]/45"
          aria-label="Buscar usuários"
        />
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as UserSort);
            setPage(0);
          }}
          className="h-10 rounded-xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-2 text-sm font-bold text-[var(--ink)]"
          aria-label="Ordenar"
        >
          <option value="recent">Mais novos</option>
          <option value="seen">Vistos por último</option>
          <option value="coins">Mais moedas</option>
          <option value="division">Divisão mais alta</option>
        </select>
      </div>
      {error && <p className="m-3 rounded-xl bg-[var(--red)] px-3 py-2 text-sm font-bold">Não deu para carregar.</p>}
      {!res ? (
        <p className="p-4 text-sm text-white/70">Carregando...</p>
      ) : res.rows.length === 0 ? (
        <p className="p-4 text-sm text-white/70">Nenhum usuário encontrado.</p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.6fr)_7rem_6rem_7rem_7rem] gap-3 px-4 py-2 text-[0.68rem] font-extrabold uppercase tracking-wider text-white/55 md:grid">
            <span>Técnico</span>
            <span>Divisão</span>
            <span className="text-right">Moedas</span>
            <span>Cadastro</span>
            <span>Visto</span>
          </div>
          <ul>
            {res.rows.map((r) => (
              <li key={r.id} className="border-t border-white/10">
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2 text-left hover:bg-white/5 md:grid-cols-[minmax(0,1.6fr)_7rem_6rem_7rem_7rem]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Dot on={online(r.last_seen)} />
                    <Crest crest={r.crest} tag={r.tag} />
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">
                        {r.name ?? "Sem clube"}
                        {r.banned && <span className="ml-1.5 rounded bg-[var(--red)] px-1 text-[0.6rem] uppercase">bloqueado</span>}
                        {r.name && !r.has_squad && <span className="ml-1.5 rounded bg-white/15 px-1 text-[0.6rem] uppercase">sem elenco</span>}
                      </span>
                      <span className="block truncate text-xs font-bold text-white/60">{r.email}</span>
                    </span>
                  </span>
                  <span className="text-right text-xs font-bold md:text-left md:text-sm">{r.division !== null ? divisionInfo(r.division).short : "—"}</span>
                  <span className="t-num hidden text-right md:block">{r.coins !== null ? fmt(r.coins) : "—"}</span>
                  <span className="hidden text-sm font-bold text-white/75 md:block">{dt(r.created_at)}</span>
                  <span className="col-span-2 text-xs font-bold text-white/60 md:col-span-1 md:text-sm">
                    <span className="md:hidden">{r.coins !== null ? `${fmt(r.coins)} moedas · ` : ""}</span>
                    {ago(r.last_seen)}
                    <span className="md:hidden"> · {r.days} dias de jogo</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t-[3px] border-[var(--ink)] p-3 text-sm font-bold">
            <span className="text-white/70">
              {fmt(page * PER + 1)}–{fmt(page * PER + res.rows.length)} de {fmt(res.total)}
            </span>
            <span className="flex gap-1">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="btn btn-paper btn-sm" aria-label="Página anterior">
                <Icon name="chevron-left" className="h-4 w-4" />
              </button>
              <button type="button" disabled={(page + 1) * PER >= res.total} onClick={() => setPage((p) => p + 1)} className="btn btn-paper btn-sm" aria-label="Próxima página">
                <Icon name="chevron-right" className="h-4 w-4" />
              </button>
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------- ficha do usuário */

function UserSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const [u, setU] = useState<UserDetail | null | undefined>(undefined);
  const [action, setAction] = useState<"coins" | "rename" | "ban" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const reload = useCallback(() => {
    loadUser(id)
      .then(setU)
      .catch(() => setU(null));
  }, [id]);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(27,16,56,.7)] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label="Ficha do usuário"
        onClick={(e) => e.stopPropagation()}
        className="anim-pop flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] text-white shadow-[0_6px_0_var(--ink)] sm:rounded-[24px]"
      >
        <div className="flex items-center gap-3 border-b-[3px] border-[var(--ink)] p-3">
          {u?.club ? <Crest crest={u.club.crest} tag={u.club.tag} className="h-12 w-11" /> : <Crest crest={null} tag={null} className="h-12 w-11" />}
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate">{u?.club?.name ?? (u ? "Sem clube" : "...")}</p>
            <p className="truncate text-xs font-bold text-white/65">{u?.auth.email}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10" aria-label="Fechar">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {u === undefined ? (
            <p className="text-sm text-white/70">Carregando...</p>
          ) : u === null ? (
            <p className="text-sm text-white/70">Usuário não encontrado.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {msg && <p className="rounded-xl bg-[var(--grass)] px-3 py-2 text-sm font-bold text-[var(--ink)]">{msg}</p>}
              <div className="flex flex-wrap gap-1.5 text-xs font-extrabold">
                <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1">
                  <Dot on={online(u.presence?.last_seen)} /> {online(u.presence?.last_seen) ? `Online · ${screenName(u.presence?.screen ?? null)}` : `Visto ${ago(u.presence?.last_seen)}`}
                </span>
                {u.admin && <span className="rounded-lg bg-[var(--hot)] px-2 py-1">Admin</span>}
                <span className="rounded-lg bg-white/10 px-2 py-1">Entrou por {u.auth.provider === "google" ? "Google" : u.auth.provider === "email" ? "e-mail" : (u.auth.provider ?? "—")}</span>
                {!u.auth.confirmed && <span className="rounded-lg bg-[var(--orange)] px-2 py-1 text-[var(--ink)]">E-mail não confirmado</span>}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Moedas" value={u.club ? fmt(u.club.coins) : "—"} />
                <Stat label="Divisão" value={u.club ? divisionInfo(u.club.division).short : "—"} />
                <Stat label="Jogos" value={fmt(u.matches.total)} sub={`${fmt(u.matches.wins)} vitórias na liga`} />
                <Stat label="Dias de jogo" value={fmt(u.days)} />
              </div>

              <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {(
                  [
                    ["Cadastro", dt(u.auth.created_at)],
                    ["Último login", dt(u.auth.last_sign_in_at)],
                    ["Clube criado", dt(u.club?.created_at)],
                    ["Liga atual", u.club?.league_id ? `#${u.club.league_id} · vaga ${(u.club.league_slot ?? 0) + 1}` : "—"],
                    ["Último jogo", dt(u.matches.last)],
                    ["XP total das cartas", fmt(u.club?.xp_total)],
                    ["Estrutura (est./lanch./loja)", u.club ? (u.club.facilities ?? [0, 0, 0]).join(" / ") : "—"],
                    ["Leilão", `${fmt(u.auction.won)} cartas · ${fmt(u.auction.spent)} moedas${u.auction.leading ? ` · liderando ${u.auction.leading}` : ""}`],
                    ["Ganho em eventos", fmt(u.events_coins)],
                    ["Renda em casa", fmt(u.home_coins)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-white/10 py-1">
                    <dt className="truncate text-white/65">{k}</dt>
                    <dd className="shrink-0 text-right font-bold">{v}</dd>
                  </div>
                ))}
              </dl>

              {u.seasons.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-white/60">Temporadas</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {u.seasons.map((s) => (
                      <li key={s.league_id} className="flex justify-between gap-2 rounded-lg bg-white/10 px-2 py-1">
                        <span className="truncate">
                          {divisionInfo(s.division).short} #{s.league_id} · <b>{s.pos}º</b> · {s.pts} pts ({s.wins}V {s.draws}E {s.games - s.wins - s.draws}D)
                        </span>
                        <span className="shrink-0 font-bold">
                          {s.move > 0 ? "↑ subiu" : s.move < 0 ? "↓ caiu" : ""} +{fmt(s.coins)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {u.cups.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-white/60">Copas</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {u.cups.map((c) => {
                      const total = roundsOf(cupConfig(c.kind).size);
                      return (
                        <li key={c.cup_id} className="flex justify-between gap-2 rounded-lg bg-white/10 px-2 py-1">
                          <span className="truncate">
                            {cupConfig(c.kind).name} #{c.cup_id} · {dt(c.starts_at)}
                          </span>
                          <span className="shrink-0 font-bold">
                            {c.reach === null ? "em andamento" : c.reach >= total ? "Campeão" : c.reach === 0 ? "caiu na 1ª fase" : `até ${roundName(c.reach + 1, total).toLowerCase()}`}
                            {c.coins ? ` · +${fmt(c.coins)}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {u.log.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-white/60">Ações do admin neste usuário</p>
                  <ul className="flex flex-col gap-1 text-xs">
                    {u.log.map((l, i) => (
                      <li key={i} className="rounded-lg bg-white/10 px-2 py-1">
                        <b>{dt(l.at)}</b> · {describe(l.action, l.detail)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ações */}
              <div className="rounded-2xl border-[3px] border-dashed border-white/25 p-3">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-white/60">Ações</p>
                <div className="flex flex-wrap gap-2">
                  {u.club && (
                    <>
                      <button type="button" onClick={() => setAction(action === "coins" ? null : "coins")} className="btn btn-paper btn-sm">
                        Moedas
                      </button>
                      <button type="button" onClick={() => setAction(action === "rename" ? null : "rename")} className="btn btn-paper btn-sm">
                        Renomear clube
                      </button>
                    </>
                  )}
                  {!u.admin && (
                    <button type="button" onClick={() => setAction(action === "ban" ? null : "ban")} className="btn btn-sm !bg-[var(--red)] !text-white">
                      Bloquear / desbloquear
                    </button>
                  )}
                </div>
                {action && (
                  <ActionForm
                    key={action}
                    kind={action}
                    user={u}
                    onDone={(m) => {
                      setMsg(m);
                      setAction(null);
                      reload();
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionForm({ kind, user, onDone }: { kind: "coins" | "rename" | "ban"; user: UserDetail; onDone: (msg: string) => void }) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState(user.club?.name ?? "");
  const [tag, setTag] = useState(user.club?.tag ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = "h-10 w-full rounded-xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-3 text-sm font-bold text-[var(--ink)] outline-none";

  const run = async (fn: () => Promise<string>) => {
    if (!reason.trim()) return setErr("Escreva o motivo (fica no registro).");
    setBusy(true);
    setErr(null);
    try {
      onDone(await fn());
    } catch (e) {
      const m = (e as { message?: string })?.message ?? "";
      setErr(m.includes("clubs_name") ? "Nome inválido: 3 a 22 letras/números, sem espaços duplos." : m.includes("clubs_tag") ? "Sigla inválida: 3 letras ou números." : m || "Não deu certo.");
    }
    setBusy(false);
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      {kind === "coins" && (
        <label className="text-xs font-bold text-white/70">
          Quantidade (use negativo para tirar)
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1`} placeholder="ex.: 500 ou -200" />
        </label>
      )}
      {kind === "rename" && (
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
          <label className="text-xs font-bold text-white/70">
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={22} className={`${field} mt-1`} />
          </label>
          <label className="text-xs font-bold text-white/70">
            Sigla
            <input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={3} className={`${field} mt-1`} />
          </label>
        </div>
      )}
      <label className="text-xs font-bold text-white/70">
        Motivo
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={`${field} mt-1`} placeholder="Fica salvo no registro" />
      </label>
      {err && <p className="text-sm font-bold text-[var(--red)]">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {kind === "coins" && (
          <button
            type="button"
            disabled={busy || !Number(amount)}
            onClick={() =>
              void run(async () => {
                const n = Math.trunc(Number(amount));
                const left = await grantCoins(user.auth.id, n, reason);
                return `${n > 0 ? `+${fmt(n)}` : fmt(n)} moedas. Saldo agora: ${fmt(left)}.`;
              })
            }
            className="btn btn-green btn-sm"
          >
            {busy ? "Salvando..." : "Aplicar"}
          </button>
        )}
        {kind === "rename" && (
          <button
            type="button"
            disabled={busy || name.trim().length < 3 || tag.trim().length !== 3}
            onClick={() =>
              void run(async () => {
                await renameClub(user.auth.id, name, tag, reason);
                return `Clube renomeado para ${name.trim()} (${tag.trim().toUpperCase()}).`;
              })
            }
            className="btn btn-green btn-sm"
          >
            {busy ? "Salvando..." : "Renomear"}
          </button>
        )}
        {kind === "ban" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await setBan(user.auth.id, true, reason);
                  return "Conta bloqueada: não entra mais (a sessão aberta cai em até 1 h).";
                })
              }
              className="btn btn-sm !bg-[var(--red)] !text-white"
            >
              Bloquear conta
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await setBan(user.auth.id, false, reason);
                  return "Conta desbloqueada.";
                })
              }
              className="btn btn-paper btn-sm"
            >
              Desbloquear
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function describe(action: string, d: Record<string, unknown> | null) {
  const r = d?.reason ? ` — “${String(d.reason)}”` : "";
  if (action === "moedas") {
    const n = Number(d?.amount ?? 0);
    return `${n > 0 ? "deu" : "tirou"} ${fmt(Math.abs(n))} moedas (saldo ${fmt(Number(d?.coins ?? 0))})${r}`;
  }
  if (action === "renomear") {
    const from = d?.from as { name?: string; tag?: string } | undefined;
    const to = d?.to as { name?: string; tag?: string } | undefined;
    return `renomeou ${from?.name ?? "?"} (${from?.tag ?? "?"}) → ${to?.name ?? "?"} (${to?.tag ?? "?"})${r}`;
  }
  if (action === "bloquear") return `bloqueou a conta${r}`;
  if (action === "desbloquear") return `desbloqueou a conta${r}`;
  if (action.startsWith("fechar")) return `${action} #${String(d?.id ?? "?")}${d?.ok === false ? " (falhou)" : ""}`;
  return action;
}

/* ---------------------------------------------------------- competições */

function CompetitionsTab() {
  const { data, error, at, reload } = usePoll<Competitions>(loadCompetitions, 60_000);
  const [now] = useState(() => Date.now());
  if (!data) return <Loading error={error} />;
  const openLeagues = data.leagues.filter((l) => !l.closed_at);
  const closed = data.leagues.filter((l) => l.closed_at);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Refresh at={at} onClick={() => void reload()} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <Panel title={`Ligas em andamento · ${openLeagues.length}`} className="!pb-0">
          {openLeagues.length === 0 ? (
            <p className="pb-4 text-sm text-white/70">Nenhuma liga aberta.</p>
          ) : (
            <ul className="-mx-4">
              {openLeagues.map((l) => {
                const late = new Date(l.ends_at).getTime() < now - 30 * 60_000;
                return (
                  <li key={l.id} className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">
                        {divisionInfo(l.division).short} · Grupo #{l.id}
                      </span>
                      <span className="block truncate text-xs font-bold text-white/60">
                        rodada {l.played}/{l.rounds} · {l.next ? `próxima ${dt(l.next)}` : `acaba ${dt(l.ends_at)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="t-num block">
                        {l.humans}/{l.size}
                      </span>
                      <span className="block text-[0.6rem] font-extrabold uppercase text-white/55">técnicos</span>
                    </span>
                    {late && <span className="tag bg-[var(--red)] text-white">atrasada</span>}
                    <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full bg-[var(--grass)]" style={{ width: `${(l.played / l.rounds) * 100}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {closed.length > 0 && <p className="border-t border-white/10 py-2 text-xs font-bold text-white/60">{closed.length} ligas fechadas nos últimos 3 dias.</p>}
        </Panel>

        <Panel title="Copas" className="!pb-0">
          {data.cups.length === 0 ? (
            <p className="pb-4 text-sm text-white/70">Nenhuma copa ainda.</p>
          ) : (
            <ul className="-mx-4">
              {data.cups.map((c) => {
                const start = new Date(c.starts_at).getTime();
                const st = c.closed_at ? "encerrada" : now < start ? "inscrições" : "em andamento";
                return (
                  <li key={c.id} className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">
                        {cupConfig(c.kind).name} #{c.id}
                      </span>
                      <span className="block truncate text-xs font-bold text-white/60">
                        {dt(c.starts_at)} · {c.champion ? `campeão: ${c.champion.name}` : st}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="t-num block">
                        {c.entries}/{c.size}
                      </span>
                      <span className="block text-[0.6rem] font-extrabold uppercase text-white/55">inscritos</span>
                    </span>
                    <span className={`tag shrink-0 ${c.closed_at ? "bg-white/15" : now < start ? "bg-[var(--sky)]" : "bg-[var(--red)] text-white"}`}>{st}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Leilão (últimas 24 h)" className="!pb-0">
        {data.auction.length === 0 ? (
          <p className="pb-4 text-sm text-white/70">Nenhum lote.</p>
        ) : (
          <ul className="-mx-4 grid grid-cols-1 md:grid-cols-2">
            {data.auction.map((a) => {
              const openLot = new Date(a.ends_at).getTime() > now;
              return (
                <li key={`${a.round}-${a.idx}`} className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold">
                      Rodada {a.round} · lote {a.idx + 1}
                    </span>
                    <span className="block truncate text-xs font-bold text-white/60">
                      {a.name ? `${openLot ? "lidera" : "levou"}: ${a.name}` : "sem lance"} · {a.bids} lance{a.bids === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="t-num shrink-0">{a.amount ? fmt(a.amount) : "—"}</span>
                  <span className={`tag shrink-0 ${openLot ? "bg-[var(--grass)]" : "bg-white/15"}`}>{openLot ? "aberto" : "fechado"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/* --------------------------------------------------------------- registro */

function LogTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, at, reload } = usePoll<LogRow[]>(loadLog, 60_000);
  if (!data) return <Loading error={error} />;
  return (
    <Panel title="Registro de ações do admin" right={<Refresh at={at} onClick={() => void reload()} />} className="!pb-0">
      {data.length === 0 ? (
        <p className="pb-4 text-sm text-white/70">Nenhuma ação ainda. Tudo o que for feito por aqui (moedas, renomear, bloquear, fechar liga/copa) fica registrado.</p>
      ) : (
        <ul className="-mx-4">
          {data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-white/10 px-4 py-2 text-sm">
              <span className="t-num shrink-0 text-xs text-white/60">{dt(l.at)}</span>
              <span className="min-w-0 flex-1">{describe(l.action, l.detail)}</span>
              {l.target && (
                <button type="button" onClick={() => onOpen(l.target!)} className="shrink-0 rounded-lg bg-white/10 px-2 py-0.5 text-xs font-extrabold hover:bg-white/15">
                  {l.target_name ?? l.target_email ?? "usuário"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
