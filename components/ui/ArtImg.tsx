import type { ReactNode } from "react";
import { ART } from "@/lib/art-manifest";

/**
 * Versão leve de <Art> que funciona também em componentes de cliente:
 * consulta o índice gerado no build (lib/art-manifest.ts).
 */
export function ArtImg({ name, alt = "", className, fallback }: { name: string; alt?: string; className?: string; fallback: ReactNode }) {
  const src = ART[name];
  if (!src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- ícones pequenos já otimizados em WebP
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" draggable={false} />;
}
