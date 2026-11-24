import { CARD_TIERS, TIER_ORDER, type CardTier } from "@/lib/game-config";
import { Art } from "./Art";
import { PlayerAvatar, type AvatarLook } from "./PlayerAvatar";
import { TierGem } from "./TierGem";

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

const SIZES = {
  xs: "text-[9px]",
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[16px]",
  fluid: "text-[clamp(10px,3.1vw,15px)]",
} as const;

/**
 * Carta de jogador. Toda medida é em "em": o tamanho vem do font-size (prop `size`).
 * Cada raridade muda moldura, padrão de fundo, gema e número de estrelas.
 */
export function PlayerCard({
  player,
  size = "md",
  className = "",
}: {
  player: CardPlayer;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const tier = CARD_TIERS[player.tier];
  const stars = TIER_ORDER.indexOf(player.tier) + 1;
  const pct = Math.round((player.level / tier.maxLevel) * 100);

  return (
    <article
      className={`pcard pcard-${player.tier} ${SIZES[size]} ${className}`}
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
          <TierGem tier={player.tier} className="h-[2.1em] w-[2.1em] drop-shadow-[0_0.12em_0_var(--ink)]" />
        </div>

        {/* retrato */}
        <div className="relative z-[1] -mt-[2.9em] flex justify-center">
          <Art
            name={`player-${player.id}`}
            width={512}
            height={512}
            className="h-[7.4em] w-[7.4em] object-contain"
            fallback={<PlayerAvatar look={player.look} className="h-[7.4em] w-[7.4em]" />}
          />
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
            <span aria-hidden className="tracking-[0.1em] text-[var(--ink)]">
              {"★".repeat(stars)}
              <span className="opacity-25">{"★".repeat(4 - stars)}</span>
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
