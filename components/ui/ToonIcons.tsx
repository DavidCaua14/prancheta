const ink = "var(--toon-ink)";
type P = { className?: string };

export function ShieldIcon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M32 4 L56 12 Q58 40 32 60 Q6 40 8 12Z" fill="var(--toon-sky)" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 10 L32 54 Q12 38 14 16Z" fill="#fff" opacity="0.5" />
      <path d="M32 20 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="var(--toon-sun)" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function ClipboardIcon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="8" y="8" width="48" height="52" rx="7" fill="#c97d3c" stroke={ink} strokeWidth="4" />
      <rect x="14" y="15" width="36" height="39" rx="3" fill="var(--toon-grass)" stroke={ink} strokeWidth="3" />
      <rect x="21" y="3" width="22" height="11" rx="4" fill="#d9d9e3" stroke={ink} strokeWidth="4" />
      <circle cx="24" cy="26" r="3" fill="#fff" stroke={ink} strokeWidth="2" />
      <circle cx="40" cy="26" r="3" fill="#fff" stroke={ink} strokeWidth="2" />
      <circle cx="32" cy="38" r="3" fill="#fff" stroke={ink} strokeWidth="2" />
      <path d="M24 46 Q32 40 42 46" fill="none" stroke="var(--toon-sun)" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 42 l5 4 -6 2" fill="none" stroke="var(--toon-sun)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TvIcon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M22 10 L32 18 L42 6" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <rect x="4" y="18" width="56" height="40" rx="9" fill="#d8cfb8" stroke={ink} strokeWidth="4" />
      <rect x="10" y="24" width="36" height="28" rx="6" fill="var(--toon-grass)" stroke={ink} strokeWidth="3" />
      <line x1="28" y1="24" x2="28" y2="52" stroke="#fff" strokeWidth="2" />
      <circle cx="22" cy="38" r="3" fill="#fff" stroke={ink} strokeWidth="2" />
      <circle cx="53" cy="30" r="3.5" fill="var(--toon-red)" stroke={ink} strokeWidth="2" />
      <circle cx="53" cy="42" r="3.5" fill="#a39a83" stroke={ink} strokeWidth="2" />
    </svg>
  );
}

export function TrophyIcon({ className, color = "var(--toon-sun)" }: P & { color?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M16 12 H6 Q6 28 20 30" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <path d="M48 12 H58 Q58 28 44 30" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <path d="M14 6 H50 V18 Q50 40 32 42 Q14 40 14 18Z" fill={color} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M20 10 V20 Q20 30 26 34" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <rect x="27" y="42" width="10" height="8" fill={color} stroke={ink} strokeWidth="3.5" />
      <rect x="16" y="50" width="32" height="10" rx="3" fill="#7a4a2b" stroke={ink} strokeWidth="4" />
    </svg>
  );
}

export function GavelIcon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="8" y="50" width="34" height="9" rx="3" fill="#7a4a2b" stroke={ink} strokeWidth="4" />
      <path d="M30 30 L54 54" stroke={ink} strokeWidth="9" strokeLinecap="round" />
      <path d="M30 30 L54 54" stroke="#c97d3c" strokeWidth="4" strokeLinecap="round" />
      <rect x="12" y="10" width="30" height="16" rx="4" transform="rotate(45 27 18)" fill="var(--toon-orange)" stroke={ink} strokeWidth="4" />
    </svg>
  );
}

export function HandshakeIcon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M2 22 L14 18 L24 40 L12 46Z" fill="var(--toon-hot)" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M62 22 L50 18 L40 40 L52 46Z" fill="var(--toon-sky)" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M16 22 Q26 16 34 20 L44 22 L48 38 Q40 48 32 50 Q24 48 20 40Z" fill="#f2b98c" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 22 L24 30 Q28 34 34 28 L40 30" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="16" y="4" width="32" height="56" rx="7" fill="var(--toon-purple)" stroke={ink} strokeWidth="4" />
      <rect x="21" y="11" width="22" height="38" rx="3" fill="var(--toon-grass)" stroke={ink} strokeWidth="3" />
      <circle cx="32" cy="30" r="5" fill="#fff" stroke={ink} strokeWidth="2.5" />
      <circle cx="32" cy="54" r="2.5" fill={ink} />
    </svg>
  );
}

export function GiftIcon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="8" y="26" width="48" height="32" rx="4" fill="var(--toon-hot)" stroke={ink} strokeWidth="4" />
      <rect x="4" y="18" width="56" height="12" rx="4" fill="var(--toon-hot)" stroke={ink} strokeWidth="4" />
      <rect x="27" y="18" width="10" height="40" fill="var(--toon-sun)" stroke={ink} strokeWidth="3.5" />
      <path d="M32 18 Q18 2 14 12 Q14 18 32 18 Q46 18 50 12 Q46 2 32 18Z" fill="var(--toon-sun)" stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}
