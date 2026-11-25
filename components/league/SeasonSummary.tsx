"use client";

import { useEffect } from "react";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { divisionInfo } from "@/lib/league/divisions";
import type { SeasonResult } from "@/lib/league/data";

/** Aviso de fim de temporada: posição final, acesso ou rebaixamento. */
export function SeasonSummary({ season, clubName, onClose }: { season: SeasonResult; clubName: string; onClose: () => void }) {
  const from = divisionInfo(season.division);
  const to = divisionInfo(season.division + season.move);
  const up = season.move > 0;
  const down = season.move < 0;
  const champion = season.pos === 1;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const title = up ? "Acesso!" : down ? "Rebaixado" : champion ? "Campeão!" : `${season.pos}º lugar`;
  const text = up
    ? `O ${clubName} está na ${to.name}! Os times da CPU são mais fortes, a rotina continua com 8 jogos por dia. Cuidado: os ${to.down} últimos voltam para a ${to.downTo}.`
    : down
      ? `Não deu desta vez. O ${clubName} volta para a ${to.name}, onde os ${to.up} primeiros sobem de novo.`
      : champion
        ? `O ${clubName} é campeão da ${from.name}! ${from.up === 0 && !from.soon ? "O topo do Prancheta é seu: agora é defender o trono." : "Título no peito e vaga garantida na próxima temporada."}${from.soon ? ` A ${from.soon} chega numa próxima atualização.` : ""}`
        : from.up > 0
        ? `Faltou pouco: só os ${from.up} primeiros sobem. A nova temporada da ${from.name} já começou.`
        : `O ${clubName} segue na ${from.name}.${from.soon ? ` A ${from.soon} chega numa próxima atualização.` : ""}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-title"
      className="fixed inset-0 z-[90] flex overflow-y-auto bg-[rgba(27,16,56,0.82)] px-4 pb-4 pt-20 backdrop-blur-sm"
    >
      <div className="panel halftone anim-pop relative m-auto w-full max-w-sm px-5 pb-5 pt-20 text-center">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2">
          <ArtImg
            name={to.art}
            alt={to.name}
            className="h-32 w-32 object-contain drop-shadow-[0_5px_0_var(--ink)]"
            fallback={
              <span className="flex h-28 w-28 items-center justify-center rounded-3xl border-[3px] border-[var(--ink)] bg-[var(--sun)] shadow-[0_5px_0_var(--ink)]">
                <Icon name="trophy" className="h-14 w-14" />
              </span>
            }
          />
        </div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-60">Fim de temporada · {from.name}</p>
        <h2 id="season-title" className={`t-display mt-1 text-4xl ${up || champion ? "text-[var(--grass-2)]" : down ? "text-[var(--red)]" : ""}`}>
          {title}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border-[3px] border-[var(--ink)] bg-white py-2">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-wider opacity-60">Posição</p>
            <p className="t-num text-2xl leading-none">{season.pos}º</p>
          </div>
          <div className="rounded-xl border-[3px] border-[var(--ink)] bg-white py-2">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-wider opacity-60">Pontos</p>
            <p className="t-num text-2xl leading-none">{season.pts}</p>
          </div>
        </div>
        {season.coins > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--sun)] px-2.5 py-1 text-sm font-extrabold">
            <Icon name="trophy" className="h-4 w-4" /> Prêmio: +{season.coins.toLocaleString("pt-BR")} moedas
          </p>
        )}
        {(up || down) && (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm font-extrabold">
            {from.short}
            <Icon name="arrow-right" className={`h-4 w-4 ${down ? "text-[var(--red)]" : "text-[var(--grass-2)]"}`} />
            <span className={`rounded-md px-1.5 ${down ? "bg-[var(--red)] text-white" : "bg-[var(--grass)]"}`}>{to.short}</span>
          </p>
        )}
        <p className="mt-3 text-sm font-semibold">{text}</p>
        {season.xp > 0 && (
          <div className="mt-3 rounded-xl border-[3px] border-[var(--ink)] bg-white p-2.5 text-left">
            <p className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Icon name="bolt" className="h-4 w-4 text-[var(--hot)]" /> Evolução
              </span>
              <span className="t-num normal-case tracking-normal text-[var(--grass-2)]">+{season.xp} XP no elenco</span>
            </p>
            {season.evolved.length > 0 ? (
              <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto pr-1">
                {season.evolved.map((e) => (
                  <li key={`${e.name}-${e.position}`} className="flex items-center gap-2 text-sm">
                    <span className="w-9 shrink-0 rounded bg-[var(--ink)]/10 text-center text-[0.65rem] font-extrabold">{e.position}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{e.name}</span>
                    <span className="shrink-0 text-xs font-extrabold opacity-70">
                      Nv {e.from}→{e.to}
                    </span>
                    <span className="t-num w-12 shrink-0 text-right text-[var(--grass-2)]">
                      {e.overall}
                      {e.gain > 0 && <span className="text-[0.65rem]"> +{e.gain}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs font-semibold opacity-70">Nenhuma carta subiu de nível desta vez — o XP já está guardado.</p>
            )}
          </div>
        )}
        <button type="button" autoFocus onClick={onClose} className="btn btn-green btn-lg mt-5 w-full">
          {up ? `Bora pra ${to.name}!` : "Começar a nova temporada"}
        </button>
      </div>
    </div>
  );
}
