"use client";

import { CARD_TIERS, type CardTier } from "@/lib/game-config";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { MiniPitch } from "@/components/cards/MiniPitch";
import { Icon } from "@/components/ui/Icon";
import { getMyClub, getSession, saveLineup, type Club } from "@/lib/club/api";
import { decodeKit } from "@/lib/club/identity";
import { POSITION_NAMES, type BaseCard } from "@/lib/cards/generate";
import { clubCards } from "@/lib/cards/squad";
import { FORMATIONS, effective, fitLevel, strength } from "@/lib/tactics/formations";
import {
  MARKINGS,
  PASSES,
  POSTURES,
  autoLineup,
  encodeLineup,
  lineupFor,
  pickLeaders,
  withFormation,
  type Lineup,
} from "@/lib/tactics/lineup";

type Sel = { kind: "xi"; slot: number } | { kind: "bench"; card: number } | null;

const FIT_TEXT = { ok: "text-[var(--grass-3)]", adapted: "text-[#a86d00]", bad: "text-[var(--red)]" };

/** Garante capitão e cobrador entre os titulares depois de uma troca. */
function fixLeaders(l: Lineup, cards: BaseCard[]): Lineup {
  if (l.xi.includes(l.captain) && l.xi.includes(l.penalty)) return l;
  const best = pickLeaders(l.xi, cards);
  return {
    ...l,
    captain: l.xi.includes(l.captain) ? l.captain : best.captain,
    penalty: l.xi.includes(l.penalty) ? l.penalty : best.penalty,
  };
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-xs font-extrabold text-white/70">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-[var(--ink)] bg-black/30">
        <div className="h-full rounded-full bg-[var(--grass)]" style={{ width: `${Math.min(100, (value / 70) * 100)}%` }} />
      </div>
      <span className="t-num w-7 text-right text-sm text-white">{value}</span>
    </div>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; hint: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">{label}</legend>
      <div
        className="mt-2 grid gap-1 rounded-xl border-[3px] border-[var(--ink)] bg-black/25 p-1"
        style={{ gridTemplateColumns: options.length > 3 ? "repeat(auto-fit, minmax(5.4rem, 1fr))" : `repeat(${options.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={value === i}
            onClick={() => onChange(i)}
            className={`min-h-10 rounded-lg px-1 text-[0.72rem] font-extrabold leading-tight sm:text-xs ${
              value === i ? "bg-[var(--sun)] text-[var(--ink)]" : "text-white/80 hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-white/60">{options[value].hint}</p>
    </fieldset>
  );
}

/** Etiqueta de raridade para cartas que não são Base (vindas do leilão). */
function TierTag({ tier }: { tier?: CardTier }) {
  if (!tier || tier === "base") return null;
  const style = tier === "destaque" ? "bg-[var(--sky)] text-[var(--ink)]" : tier === "epica" ? "bg-[#a46bff] text-white" : "bg-[var(--sun)] text-[var(--ink)]";
  return <span className={`ml-1.5 rounded px-1 text-[0.58rem] font-extrabold uppercase ${style}`}>{CARD_TIERS[tier].label}</span>;
}

export function LineupEditor() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [tab, setTab] = useState<"time" | "tatica">("time");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getSession();
      if (!alive) return;
      if (!s) return router.replace("/entrar");
      try {
        const c = await getMyClub(s);
        if (!alive) return;
        if (!c) return router.replace("/clube/novo");
        if (!c.squad) return router.replace("/peneira");
        setSession(s);
        setClub(c);
        setLineup(lineupFor(c.lineup, clubCards(c.id, c.squad, c.xp, c.won)));
      } catch {
        router.replace("/entrar?erro=1");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const cards = useMemo(() => (club ? clubCards(club.id, club.squad, club.xp, club.won) : []), [club]);
  const savedCode = useMemo(() => (club && cards.length ? encodeLineup(lineupFor(club.lineup, cards)) : ""), [club, cards]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!club || !lineup || !cards.length) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" aria-label="Carregando" />
      </div>
    );
  }

  const kit = decodeKit(club.kit);
  const formation = FORMATIONS[lineup.formation];
  const xiCards = lineup.xi.map((i) => cards[i]);
  const bench = cards.map((c, i) => ({ c, i })).filter(({ i }) => !lineup.xi.includes(i));
  const power = strength(formation, xiCards);
  const dirty = encodeLineup(lineup) !== savedCode;
  const outOfPlace = formation.slots
    .map((s, slot) => ({ slot, role: s.role, card: xiCards[slot], level: fitLevel(xiCards[slot], s.role), value: effective(xiCards[slot], s.role) }))
    .filter((o) => o.level !== "ok");
  const misplaced = outOfPlace.filter((o) => o.level === "bad").length;

  function update(next: Lineup) {
    setLineup(fixLeaders(next, cards));
  }

  function clickSlot(slot: number) {
    if (!lineup) return;
    if (!sel) return setSel({ kind: "xi", slot });
    if (sel.kind === "xi") {
      if (sel.slot !== slot) {
        const xi = [...lineup.xi];
        [xi[sel.slot], xi[slot]] = [xi[slot], xi[sel.slot]];
        update({ ...lineup, xi });
      }
      return setSel(null);
    }
    const xi = [...lineup.xi];
    xi[slot] = sel.card;
    update({ ...lineup, xi });
    setSel(null);
  }

  function clickBench(card: number) {
    if (!lineup) return;
    if (sel?.kind === "xi") {
      const xi = [...lineup.xi];
      xi[sel.slot] = card;
      update({ ...lineup, xi });
      return setSel(null);
    }
    setSel(sel?.kind === "bench" && sel.card === card ? null : { kind: "bench", card });
  }

  async function save() {
    if (!session || !club || !lineup) return;
    setSaving(true);
    const res = await saveLineup(session, club, encodeLineup(lineup));
    setSaving(false);
    if ("club" in res) {
      setClub(res.club);
      setToast("Escalação salva!");
    } else {
      setToast("Não deu para salvar. Confira sua internet.");
    }
  }

  const selectedSlot = sel?.kind === "xi" ? sel.slot : null;
  const help = !sel
    ? "Toque em um jogador e depois em outro para trocar de lugar."
    : sel.kind === "xi"
      ? `Trocar ${xiCards[sel.slot].name}: toque em outra vaga ou em um reserva.`
      : `Escalar ${cards[sel.card].name}: toque na vaga do campinho ou na lista.`;

  /* ---------------------------------------------------------------- */

  const teamPanel = (
    <div className="flex flex-col gap-4">
      {/* formações */}
      <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-3 shadow-[0_5px_0_var(--ink)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">Formação</p>
          <button
            type="button"
            onClick={() => {
              update(autoLineup(lineup, cards));
              setSel(null);
            }}
            className="btn btn-paper btn-sm"
          >
            <Icon name="bolt" className="h-4 w-4 text-[var(--orange)]" />
            Escalação automática
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Formação">
          {FORMATIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={lineup.formation === f.id}
              onClick={() => {
                update(withFormation(lineup, f.id, cards));
                setSel(null);
              }}
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl border-[3px] border-[var(--ink)] px-1 py-1 ${
                lineup.formation === f.id ? "bg-[var(--sun)] text-[var(--ink)]" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <span className="t-num text-sm leading-tight">{f.name}</span>
              {f.nick && <span className="text-[0.6rem] font-extrabold leading-tight opacity-75">{f.nick}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* campinho + força */}
      <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-3 shadow-[0_5px_0_var(--ink)]">
        <MiniPitch
          cards={xiCards}
          kit={kit}
          slots={formation.slots}
          selected={selectedSlot}
          captain={cards[lineup.captain]}
          showFit
          previewCard={sel ? (sel.kind === "xi" ? xiCards[sel.slot] : cards[sel.card]) : null}
          clickEmpty
          onSlotClick={clickSlot}
          className="mx-auto max-w-[420px] text-[clamp(10px,3.1vw,13px)] lg:text-[13px]"
        />
        <p className="mt-2 text-center text-xs font-bold text-white/70" aria-live="polite">
          {help}
        </p>
        <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[0.68rem] font-extrabold text-white/75">
          <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--grass)]" />Na posição</li>
          <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--sun)]" />Adaptado</li>
          <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--red)]" />Improvisado</li>
        </ul>
        <div className="mt-3 grid gap-1.5">
          <Bar label="DEF" value={power.def} />
          <Bar label="MEI" value={power.mei} />
          <Bar label="ATA" value={power.ata} />
        </div>
        {outOfPlace.length > 0 && (
          <div className={`mt-3 rounded-xl border-2 px-3 py-2.5 text-xs font-bold text-white ${misplaced > 0 ? "border-[var(--red)] bg-[var(--red)]/20" : "border-[var(--sun)] bg-[var(--sun)]/10"}`}>
            <p className="flex items-center gap-1.5 text-sm font-extrabold">
              <Icon name="warning" className="h-4 w-4 shrink-0 text-[var(--sun)]" />
              {outOfPlace.length} {outOfPlace.length === 1 ? "jogador fora de posição" : "jogadores fora de posição"}
            </p>
            <ul className="mt-1.5 grid gap-1">
              {outOfPlace.map((o) => (
                <li key={o.slot} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {o.card.name} <span className="opacity-60">({o.card.position})</span> jogando de {o.role}
                  </span>
                  <span className={`t-num shrink-0 rounded px-1.5 ${o.level === "bad" ? "bg-[var(--red)]" : "bg-[var(--sun)] text-[var(--ink)]"}`}>
                    {o.card.overall}
                    <Icon name="arrow-right" className="mx-0.5 inline h-3 w-3 align-[-1px]" />
                    {o.value}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                update(autoLineup(lineup, cards));
                setSel(null);
              }}
              className="mt-2.5 text-xs font-extrabold text-[var(--sun)] underline underline-offset-2"
            >
              Corrigir com a escalação automática
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const listPanel = (
    <div className="overflow-hidden rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[0_5px_0_var(--ink)]">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="bg-[var(--ink)] text-left text-[0.68rem] uppercase tracking-wider text-white/80">
            <th className="w-12 py-2 pl-3">Vaga</th>
            <th className="py-2">Jogador</th>
            <th className="w-10 py-2 text-center">Id.</th>
            <th className="w-12 py-2 pr-3 text-right">Força</th>
          </tr>
        </thead>
        <tbody>
          {formation.slots.map((s, slot) => {
            const idx = lineup.xi[slot];
            const c = cards[idx];
            const lvl = fitLevel(c, s.role);
            const active = selectedSlot === slot;
            return (
              <tr
                key={`xi-${slot}`}
                onClick={() => clickSlot(slot)}
                className={`cursor-pointer border-b border-[var(--ink)]/10 ${
                  active ? "bg-[var(--sun)]" : lvl === "bad" ? "bg-[#ffe0e0] hover:bg-[#ffd0d0]" : lvl === "adapted" ? "bg-[#fff6d6] hover:bg-[#ffefb8]" : "hover:bg-[var(--cream)]"
                }`}
              >
                <td className="py-1.5 pl-3">
                  <span className={`t-num rounded px-1.5 py-0.5 text-[0.65rem] text-white ${lvl === "bad" ? "bg-[var(--red)]" : "bg-[var(--ink)]"}`}>{s.role}</span>
                </td>
                <td className="truncate py-1.5 font-bold">
                  {c.name}
                  <TierTag tier={c.tier} />
                  {lvl === "ok" ? (
                    <span className="ml-1.5 text-xs font-semibold opacity-50">{c.position}</span>
                  ) : (
                    <span
                      className={`ml-1.5 rounded px-1 text-[0.6rem] font-extrabold uppercase ${lvl === "bad" ? "bg-[var(--red)] text-white" : "bg-[var(--sun)] text-[var(--ink)]"}`}
                    >
                      {c.position} · {lvl === "bad" ? "improvisado" : "adaptado"}
                    </span>
                  )}
                  {idx === lineup.captain && <span className="ml-1 rounded bg-[var(--sky)] px-1 text-[0.6rem] font-extrabold">C</span>}
                  {idx === lineup.penalty && <span className="ml-1 rounded bg-[var(--hot)] px-1 text-[0.6rem] font-extrabold text-white">P</span>}
                </td>
                <td className="py-1.5 text-center text-xs opacity-70">{c.age}</td>
                <td className={`t-num py-1.5 pr-3 text-right ${FIT_TEXT[lvl]}`}>{effective(c, s.role)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={4} className="bg-[var(--cream)] px-3 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-wider opacity-70">
              Reservas
            </td>
          </tr>
          {bench.map(({ c, i }) => {
            const active = sel?.kind === "bench" && sel.card === i;
            return (
              <tr
                key={`b-${i}`}
                onClick={() => clickBench(i)}
                className={`cursor-pointer border-b border-[var(--ink)]/10 ${active ? "bg-[var(--sun)]" : "hover:bg-[var(--cream)]"}`}
              >
                <td className="py-1.5 pl-3">
                  <span className="t-num rounded border border-[var(--ink)]/30 px-1.5 py-0.5 text-[0.65rem]">RES</span>
                </td>
                <td className="truncate py-1.5 font-bold">
                  {c.name}
                  <TierTag tier={c.tier} />
                  <span className="ml-1.5 text-xs font-semibold opacity-50">{POSITION_NAMES[c.position]}</span>
                </td>
                <td className="py-1.5 text-center text-xs opacity-70">{c.age}</td>
                <td className="t-num py-1.5 pr-3 text-right">{c.overall}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const xiOptions = lineup.xi.map((i) => ({ i, c: cards[i] }));
  const tacticPanel = (
    <div className="flex flex-col gap-5 rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 shadow-[0_5px_0_var(--ink)]">
      <p className="t-heading text-white">Tática</p>
      <Segmented label="Postura" options={POSTURES} value={lineup.posture} onChange={(v) => update({ ...lineup, posture: v })} />
      <Segmented label="Marcação" options={MARKINGS} value={lineup.marking} onChange={(v) => update({ ...lineup, marking: v })} />
      <Segmented label="Passes" options={PASSES} value={lineup.passing} onChange={(v) => update({ ...lineup, passing: v })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        {(
          [
            ["Capitão", "captain"],
            ["Pênaltis", "penalty"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="block">
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/60">{label}</span>
            <select
              value={lineup[key]}
              onChange={(e) => update({ ...lineup, [key]: Number(e.target.value) })}
              className="mt-2 h-11 w-full rounded-xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-2 text-sm font-bold text-[var(--ink)]"
            >
              {xiOptions.map(({ i, c }) => (
                <option key={i} value={i}>
                  {c.name} ({c.position} {c.overall})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* topo */}
      <header className="sticky top-0 z-30 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-6">
          <Link
            href="/jogo"
            onClick={(e) => {
              if (dirty && !window.confirm("Sair sem salvar a escalação?")) e.preventDefault();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-[var(--ink)] bg-white/10 text-lg font-extrabold text-white"
            aria-label="Voltar"
          >
            <Icon name="back" className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-white">Escalação</p>
            <p className="truncate text-xs font-bold text-white/60">
              {club.name} · {formation.name}
            </p>
          </div>
          <span className="flex shrink-0 flex-col items-center rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-2.5 py-0.5 text-[var(--ink)]">
            <span className="text-[0.55rem] font-extrabold uppercase leading-none tracking-wider">OVR</span>
            <span className="t-num text-lg leading-none">{power.ovr}</span>
          </span>
          <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-green btn-sm hidden disabled:opacity-50 lg:inline-flex">
            {saving ? "Salvando..." : dirty ? "Salvar" : "Salvo"}
            {!saving && !dirty && <Icon name="check" className="h-4 w-4" />}
          </button>
        </div>
        {/* abas (celular) */}
        <div className="grid grid-cols-2 gap-1 px-3 pb-2 lg:hidden" role="tablist">
          {(
            [
              ["time", "Time"],
              ["tatica", "Tática"],
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

      <div className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-4 sm:px-6 lg:pb-10">
        {/* celular: abas */}
        <div className="flex flex-col gap-4 lg:hidden">
          {tab === "time" ? (
            <>
              {teamPanel}
              {listPanel}
            </>
          ) : (
            tacticPanel
          )}
        </div>
        {/* desktop: tudo à vista */}
        <div className="hidden gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_300px]">
          {teamPanel}
          {listPanel}
          {tacticPanel}
        </div>
      </div>

      {/* salvar (celular) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-[var(--ink)] bg-[var(--night-2)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-green btn-lg w-full disabled:opacity-50">
          {saving ? "Salvando..." : dirty ? "Salvar escalação" : "Escalação salva"}
          {!saving && !dirty && <Icon name="check" className="h-5 w-5" />}
        </button>
      </div>

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
