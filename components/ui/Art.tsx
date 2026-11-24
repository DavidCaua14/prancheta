import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import type { ReactNode } from "react";

const EXTENSIONS = ["webp", "png", "avif", "jpg"] as const;

/**
 * Procura public/art/<name>.(webp|png|avif|jpg) no build.
 * Se a imagem existir, usa ela; senão, usa o desenho SVG provisório.
 * Assim, para trocar uma arte basta salvar o arquivo com o nome certo
 * (lista completa em docs/PROMPTS-IMAGENS.md).
 */
function findArt(name: string): string | null {
  for (const ext of EXTENSIONS) {
    const file = path.join(process.cwd(), "public", "art", `${name}.${ext}`);
    if (existsSync(file)) return `/art/${name}.${ext}`;
  }
  return null;
}

type Props = {
  name: string;
  alt?: string;
  /** Tamanho intrínseco da imagem gerada (px). */
  width: number;
  height: number;
  className?: string;
  eager?: boolean;
  sizes?: string;
  fallback: ReactNode;
};

export function Art({ name, alt = "", width, height, className, eager, sizes, fallback }: Props) {
  const src = findArt(name);
  if (!src) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      sizes={sizes}
      draggable={false}
    />
  );
}
