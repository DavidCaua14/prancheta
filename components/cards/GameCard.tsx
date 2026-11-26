"use client";

import { potentialOf } from "@/lib/cards/evolution";
import { memo } from "react";
import type { BaseCard } from "@/lib/cards/generate";
import { PALETTE, type Kit } from "@/lib/club/identity";
import { ArtImg } from "@/components/ui/ArtImg";
import { CardFrame, type CARD_SIZES } from "@/components/ui/CardFrame";
import { PlayerAvatar, type AvatarLook } from "@/components/ui/PlayerAvatar";

export function cardLook(card: BaseCard, kit: Kit): AvatarLook {
  return {
    ...card.look,
    shirt: PALETTE[kit.c1].hex,
    shirtStripe: kit.model !== 0 ? PALETTE[kit.c2].hex : undefined,
  };
}

/** Carta Base gerada, vestindo a camisa do clube. */
export const GameCard = memo(function GameCard({
  card,
  kit,
  tag,
  size = "md",
  className = "",
}: {
  card: BaseCard;
  kit: Kit;
  tag: string;
  size?: keyof typeof CARD_SIZES;
  className?: string;
}) {
  const pot = potentialOf(card);
  return (
    <CardFrame
      size={size}
      className={className}
      player={{
        name: card.name,
        position: card.position,
        overall: card.overall,
        level: card.level,
        maxLevel: pot.maxLevel,
        potential: pot.maxOverall,
        tier: card.tier ?? "base",
        club: { short: tag, color: PALETTE[kit.c1].hex },
        stats: card.stats,
      }}
      gem={<ArtImg name={`gem-${card.tier ?? "base"}`} className="h-full w-full object-contain" fallback={null} />}
      portrait={<PlayerAvatar look={cardLook(card, kit)} className="h-full w-full" />}
    />
  );
});
