"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Club } from "@/lib/club/api";
import { FACILITIES, HOME_GAMES_PER_SEASON, MAX_FACILITY_LEVEL, facilityCost, facilityIncome, homeIncome, type FacilityInfo } from "@/lib/club/facilities";
import { decodeCrest, decodeKit } from "@/lib/club/identity";
import { recentHomeIncome, seasonHistory, upgradeFacility, type HomeIncomeRow, type SeasonRow } from "@/lib/club/structure";
import { divisionInfo } from "@/lib/league/divisions";
import { CrestSvg } from "./CrestSvg";
import { KitSvg } from "./KitSvg";

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--night-2)] p-4 text-white shadow-[0_5px_0_var(--ink)] ${className}`}>{children}</section>;
}

function Coins({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <ArtImg name="icon-moeda" className="h-[1.15em] w-[1.15em] object-contain" fallback={<span className="inline-block h-[0.9em] w-[0.9em] rounded-full border-2 border-[var(--ink)] bg-[var(--sun)]" />} />
      <span className="t-num">{value.toLocaleString("pt-BR")}</span>
    </span>
  );
}

const FACILITY_ICON: Record<FacilityInfo["id"], IconName> = { estadio: "home", lanchonete: "star", loja: "shield" };

/**
 * Aba "Clube": identidade, estrutura (investimento que rende nos jogos em
 * casa), renda recente, história (temporadas e títulos) e conta.
 */
export function ClubTab({ club, onChanged, onSignOut }: { club: Club; onChanged: () => Promise<void> | void; onSignOut: () => void }) {
  const crest = decodeCrest(club.crest);
  const kit = decodeKit(club.kit);
  const div = divisionInfo(club.division);
  const [levels, setLevels] = useState<number[]>(club.facilities ?? [0, 0, 0]);
  const [coins, setCoins] = useState(club.coins);
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [income, setIncome] = useState<HomeIncomeRow[] | null>(null);
  const [seasons, setSeasons] = useState<SeasonRow[] | null>(null);

  // o clube pode ter sido relido (renda recebida em outra tela)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- acompanha o clube relido
    setLevels(club.facilities ?? [0, 0, 0]);
    setCoins(club.coins);
  }, [club.facilities, club.coins]);

  const loadExtras = useCallback(async () => {
    const [inc, hist] = await Promise.all([recentHomeIncome(club.id), seasonHistory(club.id)]);
    setIncome(inc);
    setSeasons(hist);
  }, [club.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga assíncrona (renda e temporadas)
    void loadExtras();
  }, [loadExtras]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function upgrade(f: FacilityInfo) {
    const cost = facilityCost(f.kind, levels[f.kind]);
    if (cost === null) return;
    setBusy(f.kind);
    const r = await upgradeFacility(f.kind);
    setBusy(null);
    if (r.ok) {
      setLevels(r.levels);
      setCoins((c) => c - cost);
      setToast(`${f.name}: ${f.levels[r.levels[f.kind]]}! Agora rende ${facilityIncome(f.kind, r.levels[f.kind], club.division)} moedas por jogo em casa.`);
      await onChanged();
      void loadExtras();
    } else {
      setToast(r.reason === "coins" ? "Moedas insuficientes para essa obra." : r.reason === "max" ? "Já está no nível máximo." : "Não deu para fazer a obra agora. Tente de novo.");
    }
  }

  const perGame = homeIncome(levels, club.division);
  const titles = seasons?.filter((s) => s.pos === 1) ?? [];
  const promotions = seasons?.filter((s) => s.move > 0).length ?? 0;
  const best = seasons?.length ? seasons.reduce((a, b) => (b.division > a.division || (b.division === a.division && b.pos < a.pos) ? b : a)) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {/* identidade */}
        <Panel className="relative overflow-hidden !p-0">
          <div className="halftone flex items-center gap-4 bg-[var(--hot)] p-4 sm:p-5">
            <CrestSvg crest={crest} tag={club.tag} className="h-24 w-20 shrink-0 drop-shadow-[0_4px_0_var(--ink)] sm:h-28 sm:w-24" title={`Escudo do ${club.name}`} />
            <div className="min-w-0 flex-1">
              <h2 className="t-display truncate text-2xl leading-tight sm:text-3xl">{club.name}</h2>
              <p className="font-mono text-sm font-bold tracking-[0.25em] text-[var(--sun)]">{club.tag}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--ink)] bg-[var(--night-2)] px-2 py-0.5 text-xs font-extrabold">
                <ArtImg name={div.art} className="h-5 w-5 object-contain" fallback={<Icon name="trophy" className="h-4 w-4 text-[var(--sun)]" />} />
                {div.name}
              </p>
            </div>
            <KitSvg kit={kit} number={10} className="hidden h-24 w-24 shrink-0 sm:block" />
          </div>
          <dl className="grid grid-cols-3 divide-x-2 divide-white/10 text-center">
            <div className="py-3">
              <dt className="text-[0.62rem] font-extrabold uppercase tracking-wider text-white/55">Moedas</dt>
              <dd className="mt-0.5 text-lg">
                <Coins value={coins} />
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-[0.62rem] font-extrabold uppercase tracking-wider text-white/55">Por jogo em casa</dt>
              <dd className="mt-0.5 text-lg text-[var(--grass)]">
                <Coins value={perGame} />
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-[0.62rem] font-extrabold uppercase tracking-wider text-white/55">Títulos</dt>
              <dd className="t-num mt-0.5 text-lg text-[var(--sun)]">{seasons ? titles.length : "–"}</dd>
            </div>
          </dl>
        </Panel>

        {/* estrutura */}
        <Panel>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="t-heading text-lg">Estrutura do clube</p>
              <p className="text-sm text-white/70">Invista moedas para faturar a cada jogo da liga em casa ({HOME_GAMES_PER_SEASON} por temporada).</p>
            </div>
            {perGame > 0 && (
              <p className="rounded-lg bg-[var(--grass)]/15 px-2 py-1 text-xs font-extrabold text-[var(--grass)]">
                ≈ {(perGame * HOME_GAMES_PER_SEASON).toLocaleString("pt-BR")} moedas por temporada
              </p>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {FACILITIES.map((f) => {
              const lvl = levels[f.kind] ?? 0;
              const cost = facilityCost(f.kind, lvl);
              const now = facilityIncome(f.kind, lvl, club.division);
              const next = lvl < MAX_FACILITY_LEVEL ? facilityIncome(f.kind, lvl + 1, club.division) : null;
              const afford = cost !== null && coins >= cost;
              return (
                <article key={f.id} className="flex flex-col rounded-[18px] border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)] shadow-[0_4px_0_var(--ink)]">
                  <div className="flex flex-col gap-2">
                    <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-[3px] border-[var(--ink)] bg-[radial-gradient(circle_at_50%_70%,#fff_0%,#d9f1ff_55%,#a9dcff_100%)] p-1.5 sm:h-28 xl:h-32">
                      <ArtImg
                        name={`${f.art}-${Math.max(1, lvl)}`}
                        className={`h-full w-full object-contain drop-shadow-[0_3px_0_rgba(27,16,56,0.25)] ${lvl === 0 ? "opacity-45 grayscale" : ""}`}
                        fallback={<ArtImg name={f.art} className={`h-full w-full object-contain drop-shadow-[0_3px_0_rgba(27,16,56,0.25)] ${lvl === 0 ? "opacity-45 grayscale" : ""}`} fallback={<Icon name={FACILITY_ICON[f.id]} className={`h-10 w-10 ${lvl === 0 ? "opacity-40" : ""}`} />} />}
                      />
                      {lvl === 0 ? (
                        <span className="absolute left-1.5 top-1.5 rounded-md border-2 border-[var(--ink)] bg-[var(--sun)] px-1.5 text-[0.6rem] font-extrabold uppercase">A construir</span>
                      ) : (
                        <span className="t-num absolute left-1.5 top-1.5 rounded-md border-2 border-[var(--ink)] bg-[var(--grass)] px-1.5 text-[0.65rem]">Nv {lvl}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="t-heading leading-tight">{f.name}</p>
                      <p className="text-xs font-bold opacity-70">{lvl === 0 ? "Ainda não construído" : `Nível ${lvl} · ${f.levels[lvl]}`}</p>
                      <div className="mt-1.5 flex gap-1" aria-label={`Nível ${lvl} de ${MAX_FACILITY_LEVEL}`}>
                        {Array.from({ length: MAX_FACILITY_LEVEL }, (_, k) => (
                          <span key={k} className={`h-2 flex-1 rounded-full border-2 border-[var(--ink)] ${k < lvl ? "bg-[var(--grass)]" : "bg-[var(--ink)]/10"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold opacity-75">{f.pitch}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
                    <div className="rounded-lg bg-[var(--cream)] py-1">
                      <p className="text-[0.58rem] font-extrabold uppercase opacity-60">Rende hoje</p>
                      <Coins value={now} className="text-sm" />
                    </div>
                    <div className="rounded-lg bg-[var(--cream)] py-1">
                      <p className="text-[0.58rem] font-extrabold uppercase opacity-60">{next === null ? "Máximo" : "Próximo nível"}</p>
                      {next === null ? <span className="t-num text-sm">—</span> : <Coins value={next} className="text-sm text-[var(--grass-2)]" />}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={cost === null || !afford || busy !== null}
                    onClick={() => void upgrade(f)}
                    className={`btn btn-sm mt-2.5 w-full disabled:opacity-50 ${afford ? "btn-green" : "btn-paper"}`}
                  >
                    {busy === f.kind ? (
                      "Construindo..."
                    ) : cost === null ? (
                      "Nível máximo"
                    ) : (
                      <>
                        {lvl === 0 ? "Construir" : "Melhorar"} · <Coins value={cost} />
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
          <p className="mt-3 flex gap-2 text-xs font-semibold text-white/65">
            <Icon name="warning" className="mt-px h-4 w-4 shrink-0 text-[var(--sun)]" />
            Rende só nos jogos da liga como mandante (copas são em campo neutro; amistosos não valem). Sobe com a divisão: estádio +10% e loja +20% por
            divisão. A renda cai sozinha depois de cada jogo em casa.
          </p>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {/* renda recente */}
        <Panel>
          <p className="t-heading">Últimos jogos em casa</p>
          {income === null ? (
            <p className="mt-2 text-sm text-white/60">Carregando...</p>
          ) : income.length === 0 ? (
            <p className="mt-2 text-sm text-white/70">A renda dos jogos em casa aparece aqui depois do apito final.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/10">
              {income.map((r) => (
                <li key={`${r.league_id}-${r.round}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-bold">Rodada {r.round}</span>
                    <span className="block truncate text-[0.7rem] text-white/60">
                      {r.coins === 0 ? "Sem estrutura ainda" : `Bilheteria ${r.stadium} · Lanchonete ${r.snack} · Loja ${r.shop}`}
                    </span>
                  </span>
                  <Coins value={r.coins} className={`shrink-0 font-extrabold ${r.coins ? "text-[var(--grass)]" : "text-white/50"}`} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* história */}
        <Panel>
          <p className="t-heading">História do clube</p>
          {seasons === null ? (
            <p className="mt-2 text-sm text-white/60">Carregando...</p>
          ) : seasons.length === 0 ? (
            <p className="mt-2 text-sm text-white/70">Termine a primeira temporada para começar a história do clube.</p>
          ) : (
            <>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Temporadas", seasons.length],
                    ["Acessos", promotions],
                    ["Títulos", titles.length],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white/10 py-2">
                    <dt className="text-[0.6rem] font-extrabold uppercase text-white/55">{k}</dt>
                    <dd className="t-num text-xl">{v}</dd>
                  </div>
                ))}
              </dl>
              {best && (
                <p className="mt-2 text-xs font-bold text-white/70">
                  Melhor campanha: {best.pos}º na {divisionInfo(best.division).name}
                </p>
              )}
              {titles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {titles.map((t) => (
                    <span key={t.league_id} className="inline-flex items-center gap-1 rounded-lg border-2 border-[var(--ink)] bg-[var(--sun)] px-2 py-0.5 text-xs font-extrabold text-[var(--ink)]">
                      <Icon name="trophy" className="h-3.5 w-3.5" /> {divisionInfo(t.division).short}
                    </span>
                  ))}
                </div>
              )}
              <ul className="mt-3 divide-y divide-white/10 text-sm">
                {seasons.slice(0, 6).map((s) => (
                  <li key={s.league_id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="truncate">{divisionInfo(s.division).name}</span>
                    <span className="flex shrink-0 items-center gap-2 font-bold">
                      {s.move > 0 && <span className="text-[0.65rem] text-[var(--grass)]">▲ subiu</span>}
                      {s.move < 0 && <span className="text-[0.65rem] text-[var(--red)]">▼ caiu</span>}
                      <span className="t-num">{s.pos}º</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        {/* conta */}
        <Panel className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="t-heading">Conta</p>
            <p className="text-xs text-white/60">Seu clube fica salvo na nuvem.</p>
          </div>
          <button type="button" onClick={onSignOut} className="btn btn-ghost btn-sm shrink-0">
            Sair da conta
          </button>
        </Panel>
      </div>

      {toast && (
        <div role="status" className="anim-pop fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-4 py-3 text-center text-sm font-extrabold text-[var(--ink)] shadow-[0_5px_0_var(--ink)] lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
