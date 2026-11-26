"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CrestSvg } from "@/components/club/CrestSvg";
import { Icon } from "@/components/ui/Icon";
import { decodeCrest } from "@/lib/club/identity";
import type { RankClimb as Climb } from "@/lib/ranking";

/**
 * Subida no ranking com animação: o número da posição "rola" do lugar de
 * antes até o de agora, a seta pula e os escudos de quem foi ultrapassado
 * entram um a um. Sem subida: "manteve a posição".
 */
export function RankClimb({ climb }: { climb: Climb }) {
  const { before, after, passed } = climb;
  const up = before - after;
  const [shown, setShown] = useState(before);

  useEffect(() => {
    if (up <= 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sem animação: pula direto para a posição final
      setShown(after);
      return;
    }
    // ~1,2 s no total, no máximo 40 passos (subidas grandes andam de vários em vários)
    const steps = Math.min(up, 40);
    const every = Math.max(45, Math.round(1200 / steps));
    let k = 0;
    const id = window.setInterval(() => {
      k++;
      setShown(k >= steps ? after : Math.round(before - (up * k) / steps));
      if (k >= steps) window.clearInterval(id);
    }, every);
    return () => window.clearInterval(id);
  }, [before, after, up]);

  return (
    <Link
      href="/ranking"
      className={`mt-3 block rounded-2xl border-[3px] border-[var(--ink)] p-3 ${up > 0 ? "climb-glow bg-[var(--grass)] text-[var(--ink)]" : "bg-white/10 text-white"}`}
      aria-label={up > 0 ? `Subiu ${up} ${up === 1 ? "posição" : "posições"} no ranking: do ${before}º para o ${after}º` : `Manteve a ${after}ª posição no ranking`}
    >
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5">
          {up > 0 && <span className="t-num text-base opacity-60 line-through decoration-2 max-[359px]:hidden">{before}º</span>}
          <span className="relative flex h-12 min-w-[3.2rem] items-center justify-center overflow-hidden rounded-xl border-[3px] border-[var(--ink)] bg-[var(--sun)] px-1.5 text-[var(--ink)]">
            <span key={shown} className="t-num climb-tick text-2xl">
              {shown}º
            </span>
          </span>
          {up > 0 && (
            <span className="climb-arrow flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[var(--ink)] bg-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path d="M12 4l7 8h-4.5v8h-5v-8H5z" fill="var(--grass-2)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="t-heading leading-tight max-[359px]:text-sm">
            {up > 0 ? `Subiu ${up} ${up === 1 ? "posição" : "posições"}!` : `Manteve a ${after}ª posição`}
          </p>
          <p className={`text-xs font-bold ${up > 0 ? "opacity-75" : "text-white/65"}`}>{up > 0 ? "no ranking geral" : "Continue vencendo para subir no ranking"}</p>
        </div>
        <Icon name="chevron-right" className="h-5 w-5 shrink-0 max-[359px]:hidden" />
      </div>
      {passed.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.65rem] font-extrabold uppercase opacity-70">Ultrapassou</span>
          {passed.map((p, i) => (
            <span
              key={p.tag + i}
              className="climb-pass inline-flex max-w-[11rem] items-center gap-1 rounded-lg border-2 border-[var(--ink)] bg-white px-1.5 py-0.5 text-xs font-extrabold text-[var(--ink)]"
              style={{ animationDelay: `${0.5 + i * 0.25}s` }}
            >
              <CrestSvg crest={decodeCrest(p.crest)} tag={p.tag} className="h-5 w-4 shrink-0" />
              <span className="truncate">{p.name}</span>
            </span>
          ))}
          {up > passed.length && <span className="text-xs font-extrabold opacity-70">e mais {up - passed.length}</span>}
        </div>
      )}
    </Link>
  );
}
