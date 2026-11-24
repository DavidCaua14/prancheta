"use client";

import { useId } from "react";
import { PALETTE, type Kit } from "@/lib/club/identity";

const INK = "#1b1038";
const SHIRT = "M31 8 L16 13 L3 31 L14 43 L22 37 V94 H78 V37 L86 43 L97 31 L84 13 L69 8 Q50 22 31 8 Z";

function Model({ model, color }: { model: number; color: string }) {
  switch (model) {
    case 1: // listras
      return (
        <g fill={color}>
          {[30, 46, 62].map((x) => (
            <rect key={x} x={x} y="0" width="8" height="100" />
          ))}
          <rect x="14" y="0" width="8" height="100" />
          <rect x="78" y="0" width="8" height="100" />
        </g>
      );
    case 2: // diagonal
      return <polygon points="14,20 34,8 90,90 90,100 72,100 14,34" fill={color} />;
    case 3: // metade
      return <rect x="50" y="0" width="50" height="100" fill={color} />;
    case 4: // faixa
      return <rect x="0" y="44" width="100" height="18" fill={color} />;
    case 5: // quartos
      return (
        <g fill={color}>
          <rect x="50" y="0" width="50" height="50" />
          <rect x="0" y="50" width="50" height="50" />
        </g>
      );
    case 6: // aros
      return (
        <g fill={color}>
          {[28, 48, 68, 88].map((y) => (
            <rect key={y} x="0" y={y} width="100" height="10" />
          ))}
        </g>
      );
    default:
      return null;
  }
}

/** Camisa do clube desenhada a partir do código compacto. */
export function KitSvg({ kit, className, number }: { kit: Kit; className?: string; number?: number }) {
  const id = useId().replace(/:/g, "");
  const c1 = PALETTE[kit.c1].hex;
  const c2 = PALETTE[kit.c2].hex;
  const c3 = PALETTE[kit.c3].hex;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <clipPath id={`kit-${id}`}>
          <path d={SHIRT} />
        </clipPath>
      </defs>
      <path d={SHIRT} fill={INK} transform="translate(0 3)" />
      <g clipPath={`url(#kit-${id})`}>
        <rect width="100" height="100" fill={c1} />
        <Model model={kit.model} color={c2} />
        {/* punhos */}
        <polygon points="3,31 14,43 18,39 7,27" fill={c3} />
        <polygon points="97,31 86,43 82,39 93,27" fill={c3} />
        <path d="M22 37 L14 43" stroke={INK} strokeWidth="2" opacity="0.4" />
        <path d="M78 37 L86 43" stroke={INK} strokeWidth="2" opacity="0.4" />
        <path d="M0 0 H100 V20 Q50 30 0 20 Z" fill="#fff" opacity="0.14" />
      </g>
      {/* gola */}
      <path d="M31 8 Q50 22 69 8 L64 6 Q50 16 36 6 Z" fill={c3} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d={SHIRT} fill="none" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      {number !== undefined && (
        <text
          x="50"
          y="72"
          textAnchor="middle"
          fontFamily="var(--font-display-face), system-ui, sans-serif"
          fontSize="26"
          fill={c3}
          stroke={INK}
          strokeWidth="2"
          paintOrder="stroke"
        >
          {number}
        </text>
      )}
    </svg>
  );
}
