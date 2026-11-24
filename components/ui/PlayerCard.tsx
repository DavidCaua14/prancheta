import { CARD_TIERS, type CardTier } from "@/lib/game-config";
import { PlayerAvatar, type AvatarLook } from "./PlayerAvatar";

export type CardPlayer = {
  name: string;
  position: string;
  overall: number;
  level: number;
  tier: CardTier;
  look: AvatarLook;
  stats: { label: string; value: number }[];
};

/** Cartinha de jogador. Fundo, brilho e limites mudam conforme a raridade. */
export function PlayerCard({ player, className = "" }: { player: CardPlayer; className?: string }) {
  const tier = CARD_TIERS[player.tier];
  const levelPct = Math.round((player.level / tier.maxLevel) * 100);

  return (
    <article
      className={`player-card card-tier-${player.tier} toon-box-sm w-[150px] shrink-0 p-2 text-[var(--toon-ink)] sm:w-[168px] ${className}`}
      aria-label={`${player.name}, carta ${tier.label}, overall ${player.overall}`}
    >
      <header className="flex items-start justify-between">
        <div className="flex flex-col items-center leading-none">
          <span className="toon-title-sm text-3xl text-white">{player.overall}</span>
          <span className="mt-0.5 text-[0.65rem] font-black">{player.position}</span>
        </div>
        <span className="toon-chip bg-white !px-2 !text-[0.6rem]">{tier.label}</span>
      </header>

      <div className="toon-halftone mx-auto -mt-2 h-[96px] w-[96px] overflow-hidden rounded-full border-[3px] border-[var(--toon-ink)] bg-white/40">
        <PlayerAvatar look={player.look} className="h-full w-full translate-y-1" />
      </div>

      <h3 className="toon-box-sm -mt-3 relative bg-[var(--toon-paper)] py-0.5 text-center font-[family-name:var(--font-toon-display)] text-base tracking-wide">
        {player.name}
      </h3>

      <dl className="mt-2 grid grid-cols-3 gap-x-1 text-center text-[0.65rem] font-black">
        {player.stats.map((s) => (
          <div key={s.label} className="rounded-md bg-white/55 py-0.5">
            <dt className="opacity-70">{s.label}</dt>
            <dd className="text-sm leading-none">{s.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="mt-2">
        <div className="flex justify-between text-[0.6rem] font-black uppercase">
          <span>Nv {player.level}</span>
          <span>máx {tier.maxLevel}</span>
        </div>
        <div className="mt-0.5 h-2.5 overflow-hidden rounded-full border-2 border-[var(--toon-ink)] bg-white/60">
          <div className="h-full bg-[var(--toon-grass)]" style={{ width: `${levelPct}%` }} />
        </div>
      </footer>
    </article>
  );
}
