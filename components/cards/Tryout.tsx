"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { MascotTipInline } from "@/components/game/MascotTip";
import { CrestSvg } from "@/components/club/CrestSvg";
import { getMyClub, getSession, saveSquad, type Club } from "@/lib/club/api";
import { decodeCrest, decodeKit } from "@/lib/club/identity";
import { POSITION_NAMES, type BaseCard } from "@/lib/cards/generate";
import { DRAFT_SLOTS, STARTERS, draftOption, draftOptions, encodeSquad, teamOverall } from "@/lib/cards/squad";
import { GameCard } from "./GameCard";
import { MiniPitch } from "./MiniPitch";
import { Icon } from "@/components/ui/Icon";

const TOTAL = DRAFT_SLOTS.length;
const progressKey = (clubId: string) => `prancheta:peneira:${clubId}`;

function loadPicks(clubId: string): (number | null)[] {
  try {
    const raw = JSON.parse(localStorage.getItem(progressKey(clubId)) ?? "null");
    if (Array.isArray(raw) && raw.length === TOTAL) {
      return raw.map((v, i) => (Number.isInteger(v) && v >= 0 && v < DRAFT_SLOTS[i].options ? v : null));
    }
  } catch {}
  return Array(TOTAL).fill(null);
}

/**
 * Peneira: o técnico escolhe 1 entre 3 cartas Base para cada posição do 4-3-3
 * e depois 3 reservas (1 entre 5). Tudo é gerado no aparelho; só a lista de
 * escolhas vai para o banco, numa única escrita no final.
 */
export function Tryout({ mascot }: { mascot: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [picks, setPicks] = useState<(number | null)[]>(() => Array(TOTAL).fill(null));
  const [editing, setEditing] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getSession();
      if (!alive) return;
      if (!s) return router.replace("/entrar");
      try {
        const c = await getMyClub(s, { fresh: true });
        if (!alive) return;
        if (!c) return router.replace("/clube/novo");
        if (c.squad) return router.replace("/jogo");
        setPicks(loadPicks(c.id));
        setSession(s);
        setClub(c);
      } catch {
        router.replace("/entrar?erro=1");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // progresso fica no aparelho até confirmar
  useEffect(() => {
    if (!club) return;
    try {
      localStorage.setItem(progressKey(club.id), JSON.stringify(picks));
    } catch {}
  }, [club, picks]);

  const firstEmpty = picks.findIndex((p) => p === null);
  const current = editing ?? (firstEmpty === -1 ? TOTAL : firstEmpty);
  const slot = DRAFT_SLOTS[current];

  const options = useMemo(() => (club && current < TOTAL ? draftOptions(club.id, current) : []), [club, current]);
  const chosen = useMemo<(BaseCard | null)[]>(
    () => (club ? picks.map((p, i) => (p === null ? null : draftOption(club.id, i, p))) : []),
    [club, picks],
  );

  if (!club) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const kit = decodeKit(club.kit);
  const crest = decodeCrest(club.crest);
  const filled = picks.filter((p) => p !== null).length;
  const review = current >= TOTAL;
  const selectedCard = selected !== null ? options[selected] : null;

  function confirmPick() {
    if (selected === null) return;
    setPicks((prev) => prev.map((p, i) => (i === current ? selected : p)));
    setSelected(null);
    setEditing(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editSlot(i: number) {
    setEditing(i);
    setSelected(picks[i]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish() {
    if (!session || !club || picks.some((p) => p === null)) return;
    setSaving(true);
    setError(null);
    const res = await saveSquad(session, club, encodeSquad(picks as number[]));
    if ("club" in res) {
      try {
        localStorage.removeItem(progressKey(club.id));
      } catch {}
      router.replace("/jogo?novo=1");
      return;
    }
    setSaving(false);
    if (res.error === "locked") router.replace("/jogo");
    else setError("Não deu para salvar agora. Confira sua internet e tente de novo.");
  }

  const tip = review
    ? "Que elenco! Confere o time e, se estiver tudo certo, confirma. Depois disso a peneira fecha."
    : editing !== null
      ? `Trocando o ${slot.label.toLowerCase()}. Escolhe outra opção ou confirma a mesma.`
      : current === 0
        ? "Bem-vindo à peneira! Escolha 1 entre 3 jogadores para cada posição. Comece pelo goleiro!"
        : slot.reserve
          ? "Agora o banco: aqui tem mais opções. Pense em quem pode entrar e mudar o jogo."
          : `Boa escolha! Agora o ${slot.label.toLowerCase()}.`;

  const starters = chosen.slice(0, STARTERS);
  const bench = chosen.slice(STARTERS);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-3 pb-32 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-10">
      <div className="min-w-0">
        {/* progresso */}
        <div className="mb-3 flex items-center gap-3">
          <CrestSvg crest={crest} tag={club.tag} className="h-12 w-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="t-heading truncate text-base text-white sm:text-lg">Peneira · {club.name}</p>
              <p className="t-num shrink-0 text-sm text-[var(--sun)]">
                {filled}/{TOTAL}
              </p>
            </div>
            <div className="mt-1.5 flex gap-1" aria-hidden>
              {DRAFT_SLOTS.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-2 flex-1 rounded-full border border-[var(--ink)] ${
                    i === current ? "bg-[var(--sun)]" : picks[i] !== null ? "bg-[var(--grass)]" : "bg-white/20"
                  } ${i === STARTERS ? "ml-1.5" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>

        <MascotTipInline mascot={mascot} always>
          {tip}
        </MascotTipInline>

        {!review ? (
          <section className="rounded-[22px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-3 shadow-[0_6px_0_var(--ink)] sm:p-5">
            <header className="flex flex-wrap items-end justify-between gap-2 px-1">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--sky)]">
                  {slot.reserve ? "Banco de reservas" : `Titular · ${slot.positions[0]}`}
                </p>
                <h1 className="t-display mt-1 text-2xl text-white sm:text-3xl">Escolha o {slot.label.toLowerCase()}</h1>
              </div>
              <p className="text-sm font-semibold text-white/60">
                {slot.options} opções · toque para escolher
                {slot.reserve && (
                  <span className="sm:hidden">
                    {" "}
                    · arraste para o lado <Icon name="arrow-right" className="inline h-3.5 w-3.5 align-[-2px]" />
                  </span>
                )}
              </p>
            </header>

            <div
              className={
                slot.reserve
                  ? "no-scrollbar -mx-3 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 pt-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-2 sm:overflow-visible sm:px-0"
                  : "mt-4 grid grid-cols-3 gap-2 pb-3 pt-2 sm:gap-4"
              }
              role="radiogroup"
              aria-label={`Opções de ${slot.label}`}
            >
              {options.map((card, i) => {
                const isSel = selected === i;
                return (
                  <button
                    key={card.key}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    onClick={() => setSelected(i)}
                    className={`group flex shrink-0 snap-center flex-col items-center rounded-2xl p-1 transition-transform duration-150 ${
                      slot.reserve ? "w-[38%] sm:w-auto" : ""
                    } ${
                      isSel ? "-translate-y-1.5 bg-[var(--sun)]/25 ring-[3px] ring-[var(--sun)]" : "hover:-translate-y-0.5"
                    }`}
                  >
                    <GameCard
                      card={card}
                      kit={kit}
                      tag={club.tag}
                      className={
                        slot.reserve
                          ? "!text-[clamp(9px,2.6vw,11px)] sm:!text-[clamp(8px,1vw,12px)]"
                          : "!text-[clamp(8px,2.45vw,15px)]"
                      }
                    />
                    <span className="mt-1.5 text-center text-[0.7rem] font-bold leading-tight text-white/75 sm:text-xs">
                      {POSITION_NAMES[card.position]} · {card.age} anos · Pé {card.foot}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ação: barra fixa no celular, inline no desktop */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-2 lg:border-0 lg:bg-transparent lg:p-0">
              <div className="mx-auto flex max-w-3xl gap-2">
                {editing !== null && (
                  <button type="button" onClick={() => {
                      setEditing(null);
                      setSelected(null);
                    }} className="btn btn-ghost">
                    Cancelar
                  </button>
                )}
                <button type="button" disabled={selected === null} onClick={confirmPick} className="btn btn-green btn-lg flex-1 disabled:opacity-50">
                  {selectedCard ? `Contratar ${selectedCard.name}` : "Escolha um jogador"}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-[22px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-4 text-[var(--ink)] shadow-[0_6px_0_var(--ink)] sm:p-6">
            <span className="tag">Elenco completo</span>
            <h1 className="t-display mt-3 text-3xl [text-shadow:0.05em_0.05em_0_var(--sun)]">Seu time está pronto!</h1>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Overall", String(teamOverall(chosen as BaseCard[]))],
                ["Formação", "4-3-3"],
                ["Jogadores", String(TOTAL)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border-[3px] border-[var(--ink)] bg-white py-2">
                  <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] opacity-55">{k}</p>
                  <p className="t-num text-2xl">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed opacity-75">
              Toque em um jogador no campinho para trocar a escolha. Depois de confirmar, a peneira não pode ser refeita
              — novos jogadores chegam jogando, no leilão e nas recompensas.
            </p>
            {error && (
              <p role="alert" className="mt-4 rounded-xl border-[3px] border-[var(--ink)] bg-[#ffe0e0] px-4 py-2.5 text-sm font-bold">
                {error}
              </p>
            )}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
              <button type="button" onClick={finish} disabled={saving} className="btn btn-green btn-lg mx-auto flex w-full max-w-3xl">
                {!saving && <Icon name="check" className="h-5 w-5" />}
                {saving ? "Salvando..." : "Confirmar elenco"}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* time sendo montado */}
      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-[22px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-3 shadow-[0_6px_0_var(--ink)]">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="t-heading text-white">Seu time</p>
            <p className="text-xs font-extrabold text-white/60">4-3-3 · OVR {teamOverall(starters.filter(Boolean) as BaseCard[]) || "--"}</p>
          </div>
          <MiniPitch
            cards={starters}
            kit={kit}
            current={current < STARTERS ? current : undefined}
            onSlotClick={editSlot}
            className="mx-auto max-w-[380px] text-[clamp(10px,3vw,13px)] lg:text-[12px]"
          />
          <p className="mt-3 px-1 text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">Reservas</p>
          <ul className="mt-1.5 grid grid-cols-3 gap-2">
            {bench.map((c, i) => {
              const idx = STARTERS + i;
              return (
                <li key={DRAFT_SLOTS[idx].key}>
                  <button
                    type="button"
                    disabled={!c}
                    onClick={() => c && editSlot(idx)}
                    className={`flex h-full w-full flex-col items-center rounded-xl border-[3px] px-1 py-2 text-center ${
                      current === idx ? "border-[var(--sun)]" : "border-[var(--ink)]"
                    } ${c ? "bg-[var(--cream)] text-[var(--ink)]" : "border-dashed bg-black/20 text-white/60"}`}
                  >
                    <span className="t-num text-lg leading-none">{c ? c.overall : "?"}</span>
                    <span className="mt-0.5 w-full truncate text-[0.7rem] font-extrabold">{c ? c.name : DRAFT_SLOTS[idx].label.replace("Reserva ", "")}</span>
                    <span className="text-[0.6rem] font-bold opacity-60">{c ? c.position : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
