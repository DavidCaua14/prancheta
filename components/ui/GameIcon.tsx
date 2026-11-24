import type { ReactNode } from "react";
import { Art } from "./Art";
import {
  ClipboardIcon,
  CoinIcon,
  GavelIcon,
  GiftIcon,
  HandshakeIcon,
  PhoneIcon,
  ShieldIcon,
  TrophyIcon,
  TvIcon,
} from "./ToonIcons";

/**
 * Ícones do jogo. Cada nome corresponde a public/art/icon-<nome>.webp;
 * enquanto a arte final não existe, usamos o SVG provisório.
 */
const FALLBACKS = {
  clube: (c: string) => <ShieldIcon className={c} />,
  tatica: (c: string) => <ClipboardIcon className={c} />,
  "ao-vivo": (c: string) => <TvIcon className={c} />,
  acesso: (c: string) => <TrophyIcon className={c} />,
  gratis: (c: string) => <GiftIcon className={c} />,
  celular: (c: string) => <PhoneIcon className={c} />,
  pvp: (c: string) => <HandshakeIcon className={c} />,
  leilao: (c: string) => <GavelIcon className={c} />,
  moeda: (c: string) => <CoinIcon className={c} />,
} satisfies Record<string, (className: string) => ReactNode>;

export type GameIconName = keyof typeof FALLBACKS;

export function GameIcon({ name, className = "h-12 w-12" }: { name: GameIconName; className?: string }) {
  return (
    <Art
      name={`icon-${name}`}
      width={384}
      height={384}
      className={`object-contain ${className}`}
      fallback={FALLBACKS[name](className)}
    />
  );
}
