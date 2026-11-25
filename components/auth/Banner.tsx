import { Art } from "@/components/ui/Art";

/**
 * Faixa ilustrada no topo dos painéis. Arte final: public/art/<name>.webp
 * (1200 × 400). Até lá, um gramado desenhado em CSS.
 */
export function Banner({ name, children }: { name: string; children?: React.ReactNode }) {
  return (
    <>
      <Art
        name={name}
        width={1200}
        height={675}
        eager
        sizes="(min-width: 640px) 576px, 100vw"
        className="absolute inset-0 h-full w-full object-cover"
        fallback={
          <div aria-hidden className="pitch absolute inset-0">
            <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
              <g fill="none" stroke="#fff" strokeWidth="3" opacity="0.85">
                <line x1="300" y1="0" x2="300" y2="200" />
                <circle cx="300" cy="100" r="48" />
                <rect x="-10" y="40" width="90" height="120" />
                <rect x="520" y="40" width="90" height="120" />
              </g>
              <path d="M150 140 Q230 40 330 92" fill="none" stroke="var(--sun)" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14" />
              <g transform="translate(345 98)">
                <circle r="13" fill="#fff" stroke="var(--ink)" strokeWidth="4" />
                <circle r="4.5" fill="var(--ink)" />
              </g>
              <path d="M120 60 l14 14 m0 -14 l-14 14 M440 130 l14 14 m0 -14 l-14 14" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" />
              <circle cx="470" cy="62" r="10" fill="none" stroke="var(--ink)" strokeWidth="6" />
            </svg>
          </div>
        }
      />
      {children}
    </>
  );
}
