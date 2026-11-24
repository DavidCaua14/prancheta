import type { CardTier } from "@/lib/game-config";
import { Art } from "./Art";

const ink = "var(--ink)";

function GemSvg({ tier, className }: { tier: CardTier; className?: string }) {
  switch (tier) {
    case "base":
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden>
          <circle cx="20" cy="20" r="16" fill="#d28a4c" stroke={ink} strokeWidth="3.5" />
          <circle cx="20" cy="20" r="9" fill="#f3c999" stroke={ink} strokeWidth="2.5" />
          <path d="M12 13 Q16 9 21 9" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
    case "destaque":
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden>
          <path d="M20 3 L36 20 L20 37 L4 20Z" fill="#57b4ee" stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M20 3 L27 20 L20 37 L13 20Z" fill="#d6f3ff" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M4 20 H36" stroke={ink} strokeWidth="2" />
        </svg>
      );
    case "epica":
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden>
          <path d="M20 3 L35 11.5 L35 28.5 L20 37 L5 28.5 L5 11.5Z" fill="#8b5cf6" stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M20 10 L28 15 L28 25 L20 30 L12 25 L12 15Z" fill="#d9c2ff" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M14 16 L19 13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case "especial":
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden>
          <path
            d="M20 2 L25 14 L38 15 L28 24 L31 37 L20 30 L9 37 L12 24 L2 15 L15 14Z"
            fill="#ffd23f"
            stroke={ink}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <path d="M20 10 L22.5 17 L29 17.5 L24 22 L25.5 28.5 L20 25 L14.5 28.5 L16 22 L11 17.5 L17.5 17Z" fill="#fff6b8" />
          <circle cx="20" cy="20" r="3" fill="#ff4f8b" stroke={ink} strokeWidth="1.8" />
        </svg>
      );
  }
}

/** Gema da raridade. Arte final: public/art/gem-<tier>.webp */
export function TierGem({ tier, className }: { tier: CardTier; className?: string }) {
  return (
    <Art
      name={`gem-${tier}`}
      width={256}
      height={256}
      className={`object-contain ${className ?? ""}`}
      fallback={<GemSvg tier={tier} className={className} />}
    />
  );
}
