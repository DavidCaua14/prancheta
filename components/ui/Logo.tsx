import { Art } from "./Art";

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden>
      <rect x="4" y="8" width="56" height="60" rx="9" fill="#c97d3c" stroke="var(--ink)" strokeWidth="4" />
      <rect x="11" y="16" width="42" height="45" rx="4" fill="var(--grass)" stroke="var(--ink)" strokeWidth="3" />
      <line x1="11" y1="38.5" x2="53" y2="38.5" stroke="#fff" strokeWidth="2" />
      <circle cx="32" cy="38.5" r="7" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M19 27 q8 -7 15 3" fill="none" stroke="var(--sun)" strokeWidth="3" strokeLinecap="round" />
      <path d="M31 27 l4 3 -5 1.5" fill="none" stroke="var(--sun)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 47l5 5m0-5l-5 5" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="50" r="3.5" fill="var(--hot)" stroke="var(--ink)" strokeWidth="2.2" />
      <rect x="20" y="2" width="24" height="12" rx="4" fill="#dcdcea" stroke="var(--ink)" strokeWidth="4" />
    </svg>
  );
}

/** Marca do jogo. Arte final opcional: public/art/logo-mark.webp */
export function Logo({ className = "", size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  const big = size === "lg";
  const markClass = big ? "h-16 w-14 sm:h-20 sm:w-[72px]" : "h-9 w-8";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Art name="logo-mark" width={256} height={288} className={`${markClass} object-contain`} fallback={<Mark className={markClass} />} />
      <span className="flex flex-col leading-none">
        <span className={`t-display ${big ? "text-4xl sm:text-6xl" : "text-lg sm:text-xl"} text-[var(--sun)]`}>Prancheta</span>
        <span
          className={`font-extrabold uppercase text-[var(--sky)] ${big ? "mt-1.5 text-xs tracking-[0.3em] sm:text-sm" : "mt-0.5 hidden text-[0.6rem] tracking-[0.24em] min-[400px]:block"}`}
        >
          Futebol Manager Online
        </span>
      </span>
    </span>
  );
}
