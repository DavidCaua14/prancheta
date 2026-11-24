import { Art } from "./Art";
import { CardFrame, type CardPlayer, CARD_SIZES } from "./CardFrame";
import { PlayerAvatar } from "./PlayerAvatar";
import { TierGem } from "./TierGem";

export type { CardPlayer } from "./CardFrame";

/** Carta para páginas do servidor: usa as artes de public/art quando existem. */
export function PlayerCard({
  player,
  size = "md",
  className = "",
}: {
  player: CardPlayer;
  size?: keyof typeof CARD_SIZES;
  className?: string;
}) {
  return (
    <CardFrame
      player={player}
      size={size}
      className={className}
      gem={<TierGem tier={player.tier} className="h-full w-full" />}
      portrait={
        <Art
          name={`player-${player.id}`}
          width={512}
          height={512}
          className="h-full w-full object-contain"
          fallback={<PlayerAvatar look={player.look} className="h-full w-full" />}
        />
      }
    />
  );
}
