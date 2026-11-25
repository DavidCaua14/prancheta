import { CARD_TIERS, TIER_ORDER, type CardTier } from "@/lib/game-config";
import type { ReactNode } from "react";
import type { AvatarLook } from "./PlayerAvatar";
import { Icon } from "./Icon";

export type CardPlayer = {
  /** Identificador da arte: public/art/player-<id>.webp substitui o avatar SVG. */
  id: string;
  name: string;
  position: string;
  overall: number;
  level: number;
  tier: CardTier;
  look: AvatarLook;
  club: { short: string; color: string };
  /** Exatamente 6 atributos. */
  stats: { label: string; value: number }[];
};

export const CARD_SIZES = {
  xs: "text-[9px]",
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[16px]",
  fluid: "text-[clamp(10px,3.1vw,15px)]",
} as const;

/**
 * Desenho da carta de jogador, sem nenhuma leitura de arquivo — funciona em
 * componentes de servidor e de cliente. Retrato e gema chegam prontos.
 * Toda medida é em "em": o tamanho vem do font-size (prop `size`).
 */
export function CardFrame({
  player,
  portrait,
  gem,
  size = "md",
  className = "",
}: {
  player: Omit<CardPlayer, "id" | "look">;
  portrait: ReactNode;
  gem: ReactNode;
  size?: keyof typeof CARD_SIZES;
  className?: string;
}) {
  const tier = CARD_TIERS[player.tier];
  const stars = TIER_ORDER.indexOf(player.tier) + 1;
  const pct = Math.round((player.level / tier.maxLevel) * 100);

  return (
    <article
      className={`pcard pcard-${player.tier} ${CARD_SIZES[size]} ${className}`}
      aria-label={`${player.name}, ${player.position}, carta ${tier.label}, overall ${player.overall}, nível ${player.level}`}
    >
      <div className="pcard-inner">
        <div className="pcard-pattern" />

        {/* topo: overall, posição, clube | gema */}
        <div className="relative z-[2] flex items-start justify-between px-[0.55em] pt-[0.5em]">
          <div className="flex flex-col items-center leading-none">
            <span className="t-num text-[2.3em] leading-[0.9] text-[var(--ink)]">{player.overall}</span>
            <span className="mt-[0.15em] text-[0.85em] font-extrabold tracking-wide text-[var(--accent)]">
              {player.position}
            </span>
            <span
              className="mt-[0.3em] flex h-[1.7em] w-[1.5em] items-center justify-center rounded-b-[0.7em] rounded-t-[0.25em] border-[0.12em] border-[var(--ink)] text-[0.55em] font-extrabold text-white"
              style={{ background: player.club.color }}
              title={player.club.short}
            >
              {player.club.short.slice(0, 1)}
            </span>
          </div>
          <span className="h-[2.1em] w-[2.1em] drop-shadow-[0_0.12em_0_var(--ink)] flex items-center justify-center">{gem}</span>
        </div>

        {/* retrato */}
        <div className="relative z-[1] -mt-[2.9em] flex justify-center">
          <span className="flex h-[7.4em] w-[7.4em] items-end justify-center">{portrait}</span>
        </div>

        {/* nome */}
        <div className="relative z-[2] -mt-[0.4em] mx-[0.3em] rounded-[0.35em] border-[0.13em] border-[var(--ink)] bg-[var(--ink)] py-[0.2em] text-center">
          <span className="t-heading block truncate px-[0.3em] text-[0.82em] text-white">{player.name}</span>
        </div>

        {/* atributos */}
        <dl className="relative z-[2] mx-[0.45em] mt-[0.4em] grid grid-cols-3 gap-[0.25em]">
          {player.stats.slice(0, 6).map((s) => (
            <div
              key={s.label}
              className="flex items-baseline justify-between rounded-[0.3em] bg-white/70 px-[0.35em] py-[0.08em] leading-tight"
            >
              <dt className="text-[0.62em] font-extrabold text-[var(--accent)]">{s.label}</dt>
              <dd className="t-num text-[0.78em]">{s.value}</dd>
            </div>
          ))}
        </dl>

        {/* nível */}
        <div className="relative z-[2] mx-[0.45em] mt-auto mb-[0.45em]">
          <div className="flex items-center justify-between text-[0.6em] font-extrabold uppercase leading-none">
            <span>
              Nv {player.level}
              <span className="opacity-60">/{tier.maxLevel}</span>
            </span>
            <span aria-hidden className="flex gap-[0.08em] text-[var(--ink)]">
              {[0, 1, 2, 3].map((k) => (
                <Icon key={k} name="star" className={`h-[1em] w-[1em] ${k < stars ? "" : "opacity-25"}`} strokeWidth={0} />
              ))}
            </span>
          </div>
          <div className="mt-[0.25em] h-[0.5em] overflow-hidden rounded-full border-[0.1em] border-[var(--ink)] bg-white/60">
            <div className="h-full rounded-full bg-[var(--grass)]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}
