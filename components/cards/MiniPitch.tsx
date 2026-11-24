"use client";

import type { BaseCard } from "@/lib/cards/generate";
import { DRAFT_SLOTS } from "@/lib/cards/squad";
import type { Kit } from "@/lib/club/identity";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { cardLook } from "./GameCard";

/**
 * Campinho vertical (4-3-3) com os titulares. Vagas vazias mostram a posição;
 * a vaga atual da peneira fica destacada.
 */
export function MiniPitch({
  cards,
  kit,
  current,
  onSlotClick,
  className = "",
}: {
  cards: (BaseCard | null)[];
  kit: Kit;
  current?: number;
  onSlotClick?: (slot: number) => void;
  className?: string;
}) {
  return (
    <div className={`pitch relative aspect-[68/90] w-full overflow-hidden rounded-2xl border-[3px] border-[var(--ink)] ${className}`}>
      <svg viewBox="0 0 68 90" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.85">
          <rect x="2" y="2" width="64" height="86" />
          <line x1="2" y1="45" x2="66" y2="45" />
          <circle cx="34" cy="45" r="7" />
          <rect x="18" y="2" width="32" height="12" />
          <rect x="18" y="76" width="32" height="12" />
          <rect x="27" y="2" width="14" height="5" />
          <rect x="27" y="83" width="14" height="5" />
        </g>
      </svg>
      {DRAFT_SLOTS.map((slot, i) => {
        if (!slot.spot) return null;
        const card = cards[i];
        const active = current === i;
        const content = (
          <>
            <span
              className={`relative flex h-[2.6em] w-[2.6em] items-center justify-center overflow-hidden rounded-full border-[0.18em] ${
                card ? "border-[var(--ink)] bg-[var(--cream)]" : "border-dashed border-white/80 bg-black/20"
              } ${active ? "shadow-[0_0_0_0.22em_var(--sun)]" : ""}`}
            >
              {card ? (
                <PlayerAvatar look={cardLook(card, kit)} className="h-[120%] w-[120%] translate-y-[0.35em]" />
              ) : (
                <span className="text-[0.72em] font-extrabold text-white">{slot.positions[0]}</span>
              )}
            </span>
            {card && (
              <span className="t-num absolute -right-[0.5em] -top-[0.3em] rounded-[0.35em] border-[0.12em] border-[var(--ink)] bg-[var(--sun)] px-[0.25em] text-[0.62em] leading-tight text-[var(--ink)]">
                {card.overall}
              </span>
            )}
            <span className="mt-[0.2em] max-w-[6em] truncate rounded-[0.3em] bg-[var(--ink)]/80 px-[0.35em] text-[0.62em] font-extrabold leading-tight text-white">
              {card ? card.name : slot.label.split("-")[0]}
            </span>
          </>
        );
        const style = { left: `${slot.spot[0]}%`, top: `${slot.spot[1]}%` };
        const cls = "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center";
        return onSlotClick && card ? (
          <button key={slot.key} type="button" style={style} className={cls} onClick={() => onSlotClick(i)} aria-label={`Trocar ${slot.label}`}>
            {content}
          </button>
        ) : (
          <div key={slot.key} style={style} className={cls}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
