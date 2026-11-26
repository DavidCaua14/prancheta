"use client";

import { memo, useId } from "react";
import { PALETTE, type Crest } from "@/lib/club/identity";

const INK = "#1b1038";

/** Contornos dos formatos (viewBox 0 0 100 120). */
const SHAPES: string[] = [
  "M50 4 L94 14 L94 54 Q94 92 50 116 Q6 92 6 54 L6 14 Z", // clássico
  "M6 8 H94 V62 Q94 98 50 116 Q6 98 6 62 Z", // francês
  "M6 20 Q50 -2 94 20 V60 Q94 96 50 116 Q6 96 6 60 Z", // ogiva
  "M50 14 A46 46 0 1 1 49.9 14 Z", // redondo
  "M50 6 C80 6 92 30 92 60 C92 92 76 114 50 114 C24 114 8 92 8 60 C8 30 20 6 50 6 Z", // oval
  "M50 4 L96 60 L50 116 L4 60 Z", // losango
  "M50 4 L94 30 L94 90 L50 116 L6 90 L6 30 Z", // hexágono
  "M6 6 H94 V74 L50 116 L6 74 Z", // flâmula
  "M20 10 H80 Q94 10 94 24 V96 Q94 110 80 110 H20 Q6 110 6 96 V24 Q6 10 20 10 Z", // quadrado
];

/** Centro vertical do símbolo em cada formato. */
const SYMBOL_Y = [56, 56, 58, 60, 60, 60, 60, 52, 60];

function Pattern({ pattern, color }: { pattern: number; color: string }) {
  switch (pattern) {
    case 1: // listras
      return (
        <g fill={color}>
          {[17, 39, 61, 83].map((x) => (
            <rect key={x} x={x - 6} y="0" width="12" height="120" />
          ))}
        </g>
      );
    case 2: // faixa
      return <rect x="0" y="44" width="100" height="26" fill={color} />;
    case 3: // diagonal
      return <polygon points="0,30 30,0 100,90 100,120 80,120 0,40" fill={color} />;
    case 4: // metade
      return <rect x="50" y="0" width="50" height="120" fill={color} />;
    case 5: // quartos
      return (
        <g fill={color}>
          <rect x="50" y="0" width="50" height="60" />
          <rect x="0" y="60" width="50" height="60" />
        </g>
      );
    case 6: // chevron
      return <polygon points="0,40 50,78 100,40 100,62 50,100 0,62" fill={color} />;
    case 7: // topo
      return <rect x="0" y="0" width="100" height="36" fill={color} />;
    default:
      return null;
  }
}

function Symbol({ symbol, color, tag }: { symbol: number; color: string; tag: string }) {
  const s = { fill: color, stroke: INK, strokeWidth: 2.6, strokeLinejoin: "round" as const };
  switch (symbol) {
    case 0:
      return (
        <text
          x="20"
          y="29"
          textAnchor="middle"
          fontFamily="var(--font-display-face), system-ui, sans-serif"
          fontSize={tag.length > 2 ? 21 : 26}
          fill={color}
          stroke={INK}
          strokeWidth="2.2"
          paintOrder="stroke"
        >
          {tag || "?"}
        </text>
      );
    case 1:
      return <path d="M20 2 L25 14 L38 15 L28 24 L31 37 L20 30 L9 37 L12 24 L2 15 L15 14 Z" {...s} />;
    case 2:
      return (
        <g>
          <circle cx="20" cy="20" r="17" {...s} />
          <path d="M20 12 L27 17 L24.5 25 L15.5 25 L13 17 Z" fill={INK} />
          <path d="M20 12 V4 M27 17 L35 14 M24.5 25 L29 33 M15.5 25 L11 33 M13 17 L5 14" stroke={INK} strokeWidth="2" />
        </g>
      );
    case 3:
      return <path d="M4 34 L5 10 L13 20 L20 5 L27 20 L35 10 L36 34 Z" {...s} />;
    case 4:
      return <path d="M24 2 L8 23 H18 L13 38 L32 15 H22 L28 2 Z" {...s} />;
    case 5:
      return (
        <path
          d="M20 2 C24 10 34 14 32 26 C31 34 26 38 20 38 C13 38 8 33 8 26 C8 19 13 16 14 10 C17 14 18 17 18 20 C21 15 21 8 20 2 Z"
          {...s}
        />
      );
    case 6:
      return <path d="M6 38 V14 H11 V7 H16 V14 H24 V7 H29 V14 H34 V38 H24 V29 Q20 24 16 29 V38 Z" {...s} />;
    case 7: {
      const rays = Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const p = (r: number, d: number) => `${20 + Math.cos(a + d) * r},${20 + Math.sin(a + d) * r}`;
        return `M${p(11, -0.22)} L${p(19, 0)} L${p(11, 0.22)} Z`;
      }).join(" ");
      return (
        <g>
          <path d={rays} {...s} />
          <circle cx="20" cy="20" r="9.5" {...s} />
        </g>
      );
    }
    case 8:
      return <path d="M15 3 H25 V15 H37 V25 H25 V37 H15 V25 H3 V15 H15 Z" {...s} />;
    case 9:
      return <path d="M20 36 C6 26 2 18 6 11 C10 4 18 6 20 12 C22 6 30 4 34 11 C38 18 34 26 20 36 Z" {...s} />;
    case 10:
      return <path d="M25 3 A17 17 0 1 0 37 29 A13 13 0 1 1 25 3 Z" {...s} />;
    default:
      return null;
  }
}

type Props = { crest: Crest; tag?: string; className?: string; title?: string };

/** Escudo do clube desenhado a partir do código compacto. */
/** Escudo (memo: listas e placares redesenham várias vezes por segundo). */
export const CrestSvg = memo(function CrestSvg({ crest, tag = "", className, title }: Props) {
  const id = useId().replace(/:/g, "");
  const shape = SHAPES[crest.shape] ?? SHAPES[0];
  const c1 = PALETTE[crest.c1].hex;
  const c2 = PALETTE[crest.c2].hex;
  const c3 = PALETTE[crest.c3].hex;
  const sy = SYMBOL_Y[crest.shape] ?? 58;

  return (
    <svg viewBox="-4 -4 108 128" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={`clip-${id}`}>
          <path d={shape} />
        </clipPath>
      </defs>
      {/* sombra dura */}
      <path d={shape} fill={INK} transform="translate(0 4)" />
      <g clipPath={`url(#clip-${id})`}>
        <rect x="0" y="0" width="100" height="120" fill={c1} />
        <Pattern pattern={crest.pattern} color={c2} />
        {/* brilho */}
        <path d="M0 0 H100 V18 Q50 34 0 18 Z" fill="#fff" opacity="0.16" />
      </g>
      <path d={shape} fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <g transform={`translate(30 ${sy - 20})`}>
        <Symbol symbol={crest.symbol} color={c3} tag={tag} />
      </g>
    </svg>
  );
});
