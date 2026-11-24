export type AvatarLook = {
  skin: string;
  hair: string;
  hairStyle: "short" | "afro" | "mohawk" | "bald" | "long" | "cap";
  shirt: string;
  shirtStripe?: string;
  beard?: boolean;
  headband?: string;
};

/**
 * Rosto de jogador em estilo cartoon, 100% SVG (zero imagens para baixar).
 * Gerado a partir de poucos parâmetros — no jogo, o "look" sai da seed da carta.
 */
export function PlayerAvatar({ look, className = "" }: { look: AvatarLook; className?: string }) {
  const ink = "var(--toon-ink)";
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {/* camisa */}
      <path d="M14 100 Q16 76 50 72 Q84 76 86 100Z" fill={look.shirt} stroke={ink} strokeWidth="3.5" />
      {look.shirtStripe && (
        <path d="M42 73 L58 73 L60 100 L40 100Z" fill={look.shirtStripe} stroke={ink} strokeWidth="2.5" />
      )}
      <path d="M40 73 Q50 84 60 73" fill="#fff" stroke={ink} strokeWidth="3" />
      {/* pescoço */}
      <rect x="42" y="60" width="16" height="14" fill={look.skin} stroke={ink} strokeWidth="3" />
      {/* cabelo de trás */}
      {look.hairStyle === "afro" && <circle cx="50" cy="38" r="30" fill={look.hair} stroke={ink} strokeWidth="3.5" />}
      {look.hairStyle === "long" && (
        <path d="M22 40 Q20 70 32 66 L68 66 Q80 70 78 40Z" fill={look.hair} stroke={ink} strokeWidth="3.5" />
      )}
      {/* orelhas */}
      <circle cx="25" cy="45" r="6" fill={look.skin} stroke={ink} strokeWidth="3" />
      <circle cx="75" cy="45" r="6" fill={look.skin} stroke={ink} strokeWidth="3" />
      {/* cabeça */}
      <path d="M26 38 Q26 14 50 14 Q74 14 74 38 L74 50 Q74 68 50 68 Q26 68 26 50Z" fill={look.skin} stroke={ink} strokeWidth="3.5" />
      {/* barba */}
      {look.beard && (
        <path d="M28 50 Q30 68 50 68 Q70 68 72 50 Q64 60 50 58 Q36 60 28 50Z" fill={look.hair} stroke={ink} strokeWidth="2.5" />
      )}
      {/* cabelo da frente */}
      {look.hairStyle === "short" && (
        <path d="M25 36 Q24 12 50 12 Q76 12 75 36 Q66 24 50 26 Q38 22 25 36Z" fill={look.hair} stroke={ink} strokeWidth="3" />
      )}
      {look.hairStyle === "afro" && (
        <path d="M26 34 Q30 18 50 20 Q70 18 74 34 Q62 28 50 30 Q38 28 26 34Z" fill={look.hair} stroke={ink} strokeWidth="2.5" />
      )}
      {look.hairStyle === "mohawk" && (
        <path d="M42 30 L40 4 L50 12 L54 2 L60 12 L58 30Z" fill={look.hair} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      )}
      {look.hairStyle === "long" && (
        <path d="M24 40 Q22 10 50 11 Q78 10 76 40 Q70 22 50 24 Q32 22 24 40Z" fill={look.hair} stroke={ink} strokeWidth="3" />
      )}
      {look.hairStyle === "cap" && (
        <>
          <path d="M24 32 Q26 10 50 10 Q74 10 76 32Z" fill={look.hair} stroke={ink} strokeWidth="3" />
          <path d="M50 32 L88 30 Q86 38 74 36Z" fill={look.hair} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        </>
      )}
      {look.headband && (
        <rect x="25" y="27" width="50" height="7" rx="2" fill={look.headband} stroke={ink} strokeWidth="2.5" />
      )}
      {/* olhos */}
      <ellipse cx="40" cy="43" rx="6" ry="7" fill="#fff" stroke={ink} strokeWidth="2.5" />
      <ellipse cx="60" cy="43" rx="6" ry="7" fill="#fff" stroke={ink} strokeWidth="2.5" />
      <circle cx="41.5" cy="44" r="3" fill={ink} />
      <circle cx="61.5" cy="44" r="3" fill={ink} />
      <circle cx="42.5" cy="42.5" r="1" fill="#fff" />
      <circle cx="62.5" cy="42.5" r="1" fill="#fff" />
      {/* sobrancelhas */}
      <path d="M33 34 L46 36" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M67 34 L54 36" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
      {/* nariz e boca */}
      <path d="M50 46 Q47 53 51 54" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M41 58 Q50 64 59 58" fill="#7a1f2b" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
