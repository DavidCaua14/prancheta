type Props = { className?: string; size?: "sm" | "lg" };

/** Marca do jogo: prancheta de técnico + nome em letreiro cartoon. */
export function Logo({ className = "", size = "sm" }: Props) {
  const big = size === "lg";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 64 72"
        className={big ? "h-20 w-[72px]" : "h-10 w-9"}
        aria-hidden
      >
        <rect x="4" y="8" width="56" height="60" rx="8" fill="#c97d3c" stroke="var(--toon-ink)" strokeWidth="4" />
        <rect x="11" y="16" width="42" height="45" rx="3" fill="var(--toon-grass)" stroke="var(--toon-ink)" strokeWidth="3" />
        <line x1="11" y1="38.5" x2="53" y2="38.5" stroke="#fff" strokeWidth="2" />
        <circle cx="32" cy="38.5" r="7" fill="none" stroke="#fff" strokeWidth="2" />
        <path d="M20 26 q8 -6 14 4" fill="none" stroke="var(--toon-sun)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 4" />
        <path d="M18 48l4 4m0-4l-4 4M42 24l4 4m0-4l-4 4" stroke="var(--toon-ink)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="40" cy="50" r="3.2" fill="var(--toon-hot)" stroke="var(--toon-ink)" strokeWidth="2" />
        <rect x="20" y="2" width="24" height="12" rx="4" fill="#d9d9e3" stroke="var(--toon-ink)" strokeWidth="4" />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={`toon-title ${big ? "text-6xl sm:text-7xl" : "text-2xl"} text-[var(--toon-sun)]`}
        >
          PRANCHETA
        </span>
        <span
          className={`font-black uppercase tracking-[0.22em] text-[var(--toon-sky)] ${big ? "mt-1 text-sm" : "text-[0.55rem]"}`}
        >
          Futebol Manager Online
        </span>
      </span>
    </span>
  );
}
