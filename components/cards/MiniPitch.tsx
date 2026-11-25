"use client";

import type { BaseCard, Position } from "@/lib/cards/generate";
import { DRAFT_SLOTS } from "@/lib/cards/squad";
import type { Kit } from "@/lib/club/identity";
import { effective, fitLevel } from "@/lib/tactics/formations";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { cardLook } from "./GameCard";

type Slot = { role: Position; spot: [number, number]; label?: string };

const DRAFT_PITCH: Slot[] = DRAFT_SLOTS.filter((s) => s.spot).map((s) => ({
  role: s.positions[0],
  spot: s.spot as [number, number],
  label: s.label.split("-")[0],
}));

const FIT_COLORS = { ok: "bg-[var(--grass)]", adapted: "bg-[var(--sun)]", bad: "bg-[var(--red)] text-white" };
const FIT_RING = { ok: "", adapted: "outline outline-[0.18em] outline-[var(--sun)]", bad: "outline outline-[0.2em] outline-[var(--red)]" };
const PREVIEW = {
  ok: { cls: "bg-[var(--grass)] text-[var(--ink)]", icon: "✓" },
  adapted: { cls: "bg-[var(--sun)] text-[var(--ink)]", icon: "~" },
  bad: { cls: "bg-[var(--red)] text-white", icon: "✕" },
};

/**
 * Campinho vertical com os titulares. Serve para a peneira (4-3-3) e para a
 * escalação (qualquer formação). Mostra o rendimento na vaga quando `showFit`.
 */
export function MiniPitch({
  cards,
  kit,
  slots = DRAFT_PITCH,
  current,
  selected,
  captain,
  showFit = false,
  previewCard = null,
  clickEmpty = false,
  onSlotClick,
  className = "",
}: {
  cards: (BaseCard | null)[];
  kit: Kit;
  slots?: Slot[];
  /** vaga destacada (peneira) */
  current?: number;
  /** vaga selecionada para troca (escalação) */
  selected?: number | null;
  /** carta do capitão (para mostrar a braçadeira) */
  captain?: BaseCard | null;
  showFit?: boolean;
  /** jogador selecionado: mostra em cada vaga como ele renderia ali */
  previewCard?: BaseCard | null;
  clickEmpty?: boolean;
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
      {slots.map((slot, i) => {
        const card = cards[i];
        const highlighted = current === i || selected === i;
        const level = card && showFit ? fitLevel(card, slot.role) : null;
        const value = card ? (showFit ? effective(card, slot.role) : card.overall) : null;
        const preview = previewCard && !highlighted ? PREVIEW[fitLevel(previewCard, slot.role)] : null;
        const content = (
          <>
            <span
              className={`relative flex h-[2.6em] w-[2.6em] items-center justify-center overflow-hidden rounded-full border-[0.18em] ${
                card ? "border-[var(--ink)] bg-[var(--cream)]" : "border-dashed border-white/80 bg-black/20"
              } ${highlighted ? "shadow-[0_0_0_0.22em_var(--sun)]" : ""} ${level && !highlighted ? FIT_RING[level] : ""}`}
            >
              {card ? (
                <PlayerAvatar look={cardLook(card, kit)} className="h-[120%] w-[120%] translate-y-[0.35em]" />
              ) : (
                <span className="text-[0.72em] font-extrabold text-white">{slot.role}</span>
              )}
            </span>
            {value !== null && (
              <span
                className={`t-num absolute -right-[0.5em] -top-[0.3em] rounded-[0.35em] border-[0.12em] border-[var(--ink)] px-[0.25em] text-[0.62em] leading-tight ${
                  level ? FIT_COLORS[level] : "bg-[var(--sun)]"
                } ${level === "bad" ? "" : "text-[var(--ink)]"}`}
              >
                {value}
              </span>
            )}
            {level && level !== "ok" && !preview && (
              <span
                className={`absolute -bottom-[0.1em] -right-[0.35em] flex h-[1.15em] w-[1.15em] items-center justify-center rounded-full border-[0.12em] border-[var(--ink)] text-[0.62em] font-extrabold leading-none ${
                  level === "bad" ? "bg-[var(--red)] text-white" : "bg-[var(--sun)] text-[var(--ink)]"
                }`}
                aria-label={level === "bad" ? "Improvisado" : "Adaptado"}
              >
                !
              </span>
            )}
            {preview && (
              <span
                className={`absolute -bottom-[0.2em] -right-[0.5em] flex h-[1.7em] w-[1.7em] items-center justify-center rounded-full border-[0.14em] border-[var(--ink)] text-[0.8em] font-extrabold leading-none shadow-[0_0.1em_0_var(--ink)] ${preview.cls}`}
              >
                {preview.icon}
              </span>
            )}
            {card && captain && card.key === captain.key && (
              <span className="absolute -left-[0.45em] -top-[0.3em] flex h-[1.2em] w-[1.2em] items-center justify-center rounded-full border-[0.12em] border-[var(--ink)] bg-[var(--sky)] text-[0.6em] font-extrabold leading-none text-[var(--ink)]">
                C
              </span>
            )}
            <span className="mt-[0.2em] max-w-[6em] truncate rounded-[0.3em] bg-[var(--ink)]/80 px-[0.35em] text-[0.62em] font-extrabold leading-tight text-white">
              {card ? (showFit ? `${slot.role} · ${card.name}` : card.name) : (slot.label ?? slot.role)}
            </span>
          </>
        );
        const style = { left: `${slot.spot[0]}%`, top: `${slot.spot[1]}%` };
        const cls = "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center";
        return onSlotClick && (card || clickEmpty) ? (
          <button
            key={i}
            type="button"
            style={style}
            className={cls}
            onClick={() => onSlotClick(i)}
            aria-pressed={selected === i}
            aria-label={card ? `${slot.role}: ${card.name}` : `Vaga ${slot.role}`}
          >
            {content}
          </button>
        ) : (
          <div key={i} style={style} className={cls}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
