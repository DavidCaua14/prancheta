"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GameCard } from "@/components/cards/GameCard";
import { CrestSvg } from "@/components/club/CrestSvg";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { loadBidders, loadLots, loadMine, placeBid, type Bidder, type BidError, type LotState } from "@/lib/auction/data";
import {
  BID_WINDOW_SECONDS,
  LOTS_PER_ROUND,
  MIN_BID,
  lotCard,
  lotTier,
  nextMinBid,
  roundAt,
  roundEnd,
  type LotTier,
} from "@/lib/auction/lots";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { decodeCrest, decodeKit } from "@/lib/club/identity";
import { CARD_TIERS } from "@/lib/game-config";
import { fmtCountdown } from "@/lib/league/data";
import { useNow } from "@/lib/league/useLeague";

const TIER_STYLE: Record<LotTier, string> = {
  destaque: "bg-[var(--sky)] text-[var(--ink)]",
  epica: "bg-[#a46bff] text-white",
  especial: "bg-[var(--sun)] text-[var(--ink)]",
};

const BID_ERRORS: Record<BidError, string> = {
  min: "Alguém deu um lance maior antes. Confira o novo valor.",
  leader: "Você já tem o maior lance neste lote.",
  coins: "Moedas insuficientes para esse lance.",
  full: "Não deu para registrar o lance. Tente de novo.",
  closed: "Este lote já foi encerrado.",
  network: "Não deu para enviar o lance. Tente de novo.",
};

const key = (round: number, idx: number) => `${round}-${idx}`;

function Coins({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <ArtImg name="icon-moeda" className="h-[1.15em] w-[1.15em] object-contain" fallback={<span className="inline-block h-[0.9em] w-[0.9em] rounded-full border-2 border-[var(--ink)] bg-[var(--sun)]" />} />
      <span className="t-num">{value.toLocaleString("pt-BR")}</span>
    </span>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-3 text-white shadow-[0_5px_0_var(--ink)] sm:p-4 ${className}`}>{children}</section>;
}

export function AuctionHouse() {
  const router = useRouter();
  const now = useNow(1000);
  const [club, setClub] = useState<Club | null>(null);
  const [lots, setLots] = useState<Map<string, LotState>>(new Map());
  const [mine, setMine] = useState<LotState[]>([]);
  const [names, setNames] = useState<Map<string, Bidder>>(new Map());
  const [tab, setTab] = useState<"vivo" | "meus">("vivo");
  const [open, setOpen] = useState<{ round: number; idx: number } | null>(null);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const round = now ? roundAt(now) : null;

  const refresh = useCallback(async (r: number, c: Club) => {
    const [cur, my] = await Promise.all([loadLots([r, r - 1]), loadMine(c.id)]);
    const map = new Map(cur.map((l) => [key(l.round, l.idx), l]));
    for (const l of my) map.set(key(l.round, l.idx), l);
    setLots(map);
    setMine(my);
    setNames(new Map(await loadBidders(cur.map((l) => l.best_club).filter((x): x is string => !!x))));
  }, []);

  // carga inicial
  useEffect(() => {
    if (round === null) return;
    let stop = false;
    (async () => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      const c = await getMyClub(s, { fresh: true });
      if (!c) return router.replace("/clube/novo");
      if (!c.squad) return router.replace("/peneira");
      if (stop) return;
      setClub(c);
      await refresh(round, c).catch(() => setToast("Não deu para carregar o leilão."));
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando muda a rodada
  }, [round === null ? null : round, router, refresh]);

  // atualiza os lances a cada 8 s enquanto a tela está visível
  useEffect(() => {
    if (!club || round === null) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(round, club).catch(() => {});
    }, 8_000);
    return () => window.clearInterval(id);
  }, [club, round, refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const kit = useMemo(() => (club ? decodeKit(club.kit) : null), [club]);
  const extras = mine.filter((l) => new Date(l.ends_at).getTime() <= now).length;

  if (!club || round === null || !kit) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const lotInfo = (r: number, idx: number) => {
    const st = lots.get(key(r, idx)) ?? null;
    const tier = lotTier(r, idx);
    const ends = st ? new Date(st.ends_at).getTime() : roundEnd(r);
    const ended = now >= ends;
    const leader = st?.best_club ?? null;
    return { st, tier, ends, ended, leader, me: leader === club.id, min: nextMinBid(tier, st?.best_amount ?? null) };
  };

  const openBid = (r: number, idx: number) => {
    const info = lotInfo(r, idx);
    setAmount(info.min);
    setOpen({ round: r, idx });
  };

  const confirm = async () => {
    if (!open) return;
    setBusy(true);
    const res = await placeBid(open.round, open.idx, amount);
    setBusy(false);
    if ("lot" in res) {
      setLots((m) => new Map(m).set(key(res.lot.round, res.lot.idx), res.lot));
      setOpen(null);
      setToast("Lance dado! Você tem o maior lance.");
      const s = await getSession();
      if (s) {
        const c = await getMyClub(s, { fresh: true });
        if (c) {
          setClub(c);
          void refresh(round, c).catch(() => {});
        }
      }
    } else {
      setToast(BID_ERRORS[res.error]);
      if (res.error === "min" || res.error === "closed") void refresh(round, club).catch(() => {});
    }
  };

  const renderLot = (r: number, idx: number) => {
                const info = lotInfo(r, idx);
                const card = lotCard(r, idx);
                const who = info.leader ? names.get(info.leader) : null;
                const canBid = !info.ended && !info.me && club.coins >= info.min;
                return (
                  <article key={key(r, idx)} className="flex min-w-0 flex-col rounded-[18px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-2 text-[var(--ink)] shadow-[0_4px_0_var(--ink)]">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`rounded-md px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider ${TIER_STYLE[info.tier]}`}>{CARD_TIERS[info.tier].label}</span>
                      <span className={`t-num text-[0.68rem] ${info.ends - now < 5 * 60_000 && !info.ended ? "text-[var(--red)]" : "opacity-60"}`}>
                        {info.ended ? "Encerrado" : fmtCountdown(info.ends - now)}
                      </span>
                    </div>
                    <button type="button" onClick={() => openBid(r, idx)} className="mt-1.5 flex justify-center" aria-label={`Ver lote: ${card.name}`}>
                      <GameCard card={card} kit={kit} tag={club.tag} className="!text-[clamp(7.5px,2.35vw,11px)]" />
                    </button>
                    <div className="mt-2 min-h-[2.4rem] text-xs font-bold leading-tight">
                      {info.st ? (
                        <>
                          <p className="flex items-center justify-between gap-1">
                            <span className="opacity-60">Maior lance</span>
                            <Coins value={info.st.best_amount} className="text-sm" />
                          </p>
                          <p className={`mt-0.5 flex items-center gap-1 truncate ${info.me ? "text-[var(--grass-2)]" : ""}`}>
                            {info.me ? (
                              <>
                                <Icon name="check" className="h-3.5 w-3.5 shrink-0" /> Você lidera
                              </>
                            ) : who ? (
                              <>
                                <CrestSvg crest={decodeCrest(who.crest)} tag={who.tag} className="h-4 w-3.5 shrink-0" />
                                <span className="truncate">{who.name}</span>
                              </>
                            ) : (
                              "—"
                            )}
                            <span className="ml-auto shrink-0 opacity-50">{info.st.bids} {info.st.bids === 1 ? "lance" : "lances"}</span>
                          </p>
                        </>
                      ) : (
                        <p className="flex items-center justify-between gap-1">
                          <span className="opacity-60">Sem lances · mín.</span>
                          <Coins value={MIN_BID[info.tier]} className="text-sm" />
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!canBid}
                      onClick={() => openBid(r, idx)}
                      className={`btn btn-sm mt-2 w-full ${canBid ? "btn-green" : "btn-paper"} disabled:opacity-50`}
                    >
                      {info.ended ? "Encerrado" : info.me ? "Você lidera" : club.coins < info.min ? "Sem moedas" : `Lance ${info.min.toLocaleString("pt-BR")}`}
                    </button>
                  </article>
                );
  };

  // disputas de rodadas anteriores que seguem abertas (lance a menos de 10 min)
  const carry = [...lots.values()].filter((l) => l.round < round && new Date(l.ends_at).getTime() > now).sort((a, b) => a.round - b.round || a.idx - b.idx);
  const leading = mine.filter((l) => new Date(l.ends_at).getTime() > now);
  const won = mine.filter((l) => new Date(l.ends_at).getTime() <= now);
  const sel = open ? lotInfo(open.round, open.idx) : null;
  const selCard = open ? lotCard(open.round, open.idx) : null;
  const step = sel ? Math.max(10, Math.ceil(sel.min * 0.05)) : 10;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-3 sm:px-6">
          <Link href="/jogo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-white" aria-label="Voltar">
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <ArtImg name="icon-leilao" className="h-10 w-10 object-contain" fallback={<Icon name="gavel" className="h-8 w-8 text-[var(--sun)]" />} />
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Leilão</p>
            <p className="truncate text-xs font-bold text-white/60">
              Rodada fecha em <span className="t-num text-[var(--sun)]">{fmtCountdown(roundEnd(round) - now)}</span>
            </p>
          </div>
          <span className="flex shrink-0 items-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2.5 py-1 text-[var(--ink)]" aria-label={`${club.coins} moedas`}>
            <Coins value={club.coins} className="text-base" />
          </span>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-1 px-3 pb-2 sm:px-6" role="tablist">
          {(
            [
              ["vivo", "Ao vivo"],
              ["meus", `Meus lances${mine.length ? ` (${mine.length})` : ""}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-9 rounded-xl text-sm font-extrabold ${tab === id ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white/80"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 pb-12 pt-4 sm:px-6">
        {tab === "vivo" && (
          <>
            <Panel className="flex items-start gap-3 !p-3">
              <Icon name="gavel" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sun)]" />
              <p className="text-xs font-semibold text-white/80 sm:text-sm">
                A cada 2 horas, 8 cartas novas. Suas moedas ficam reservadas no lance e voltam na hora se alguém cobrir. Cada lance novo faz o
                lote fechar {BID_WINDOW_SECONDS / 60} minutos depois — tempo para os outros técnicos verem e cobrirem. Quem tiver o maior lance no fim leva a carta para o elenco — sem limite de cartas{extras ? ` (você já tem ${extras} do leilão)` : ""}.
              </p>
            </Panel>
            {carry.length > 0 && (
              <>
                <div className="text-white">
                  <p className="t-heading flex items-center gap-2">
                    <Icon name="dot" className="h-3 w-3 text-[var(--red)]" /> Ainda em disputa
                  </p>
                  <p className="text-xs font-bold text-white/60">Lotes de rodadas anteriores com lance há menos de 10 minutos.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{carry.map((l) => renderLot(l.round, l.idx))}</div>
                <p className="t-heading text-white">Rodada atual</p>
              </>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: LOTS_PER_ROUND }, (_, idx) => renderLot(round, idx))}
            </div>
            <p className="text-center text-xs font-bold text-white/60">
              Destaque a partir de {MIN_BID.destaque}, Épica de {MIN_BID.epica} e Especial (a cada 8 horas) de {MIN_BID.especial} moedas. Moedas entram
              no fim de cada temporada, conforme a posição e a divisão.
            </p>
          </>
        )}

        {tab === "meus" && (
          <div className="flex flex-col gap-4">
            {[
              ["Liderando agora", leading, "Quando o lote fechar com você na frente, a carta é sua."],
              ["Arrematadas", won, "Já estão no seu elenco: escale na tela de escalação."],
            ].map(([title, list, hint]) => (
              <Panel key={title as string}>
                <p className="t-heading">
                  {title as string} <span className="text-sm text-white/50">({(list as LotState[]).length})</span>
                </p>
                <p className="text-xs font-semibold text-white/60">{hint as string}</p>
                {(list as LotState[]).length === 0 ? (
                  <p className="mt-3 text-sm text-white/60">Nada por aqui ainda.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-3 justify-items-center gap-x-2 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
                    {(list as LotState[]).map((l) => (
                      <div key={key(l.round, l.idx)} className="flex flex-col items-center gap-1">
                        <GameCard card={lotCard(l.round, l.idx)} kit={kit} tag={club.tag} className="!text-[clamp(7.5px,2.3vw,11px)]" />
                        <span className="flex items-center gap-1 text-[0.7rem] font-extrabold text-white/80">
                          <Coins value={l.best_amount} />
                          {new Date(l.ends_at).getTime() > now && <span className="t-num text-[var(--sun)]">· {fmtCountdown(new Date(l.ends_at).getTime() - now)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ))}
            {won.length > 0 && (
              <Link href="/escalacao" className="btn btn-green self-center">
                <Icon name="clipboard" className="h-5 w-5" /> Escalar as novas cartas
              </Link>
            )}
          </div>
        )}
      </div>

      {/* folha de lance */}
      {open && sel && selCard && (
        <div role="dialog" aria-modal="true" aria-label="Dar lance" className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(27,16,56,0.8)] sm:items-center sm:p-4" onClick={() => setOpen(null)}>
          <div
            className="anim-pop w-full max-w-md rounded-t-[24px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-4 text-[var(--ink)] shadow-[0_-4px_0_var(--ink)] sm:rounded-[24px] sm:shadow-[0_6px_0_var(--ink)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3">
              <GameCard card={selCard} kit={kit} tag={club.tag} className="!text-[clamp(8.5px,2.9vw,11px)] shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={`self-start rounded-md px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider ${TIER_STYLE[sel.tier]}`}>{CARD_TIERS[sel.tier].label}</span>
                <p className="t-heading mt-1 leading-tight">{selCard.name}</p>
                <p className="text-xs font-bold opacity-70">
                  {selCard.position} · {selCard.age} anos · OVR {selCard.overall}
                </p>
                <p className="mt-1 text-xs font-semibold opacity-70">
                  Evolui até o nível {CARD_TIERS[sel.tier].maxLevel} (overall máx. {CARD_TIERS[sel.tier].maxOverall}).
                </p>
                <p className="mt-auto pt-2 text-xs font-bold">
                  {sel.ended ? "Encerrado" : <>Fecha em <span className="t-num">{fmtCountdown(sel.ends - now)}</span></>}
                </p>
              </div>
            </div>
            {!sel.ended && !sel.me && (
              <>
                <div className="mt-4 flex items-center gap-2">
                  <button type="button" onClick={() => setAmount((a) => Math.max(sel.min, a - step))} disabled={amount <= sel.min} className="btn btn-paper btn-sm !px-3 disabled:opacity-40" aria-label="Diminuir lance">
                    −
                  </button>
                  <div className="flex-1 rounded-xl border-[3px] border-[var(--ink)] bg-white py-1.5 text-center">
                    <Coins value={amount} className="text-2xl" />
                  </div>
                  <button type="button" onClick={() => setAmount((a) => a + step)} className="btn btn-paper btn-sm !px-3" aria-label="Aumentar lance">
                    +
                  </button>
                </div>
                <p className="mt-1.5 flex justify-between text-xs font-bold opacity-70">
                  <span>Mínimo: {sel.min.toLocaleString("pt-BR")}</span>
                  <span>Você tem: {club.coins.toLocaleString("pt-BR")}</span>
                </p>
              </>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(null)} className="btn btn-paper">
                Fechar
              </button>
              <button
                type="button"
                disabled={busy || sel.ended || sel.me || amount > club.coins || amount < sel.min}
                onClick={() => void confirm()}
                className="btn btn-green disabled:opacity-50"
              >
                {busy ? "Enviando..." : sel.me ? "Você lidera" : amount > club.coins ? "Sem moedas" : "Dar lance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="anim-pop fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-sm rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-4 py-3 text-center text-sm font-extrabold text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
          {toast}
        </div>
      )}
    </div>
  );
}
