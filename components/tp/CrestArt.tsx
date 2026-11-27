/* eslint-disable @next/next/no-img-element -- artes e escudos já otimizados em WebP */
import { ART } from "@/lib/art-manifest";
import { CREST_SLOTS, crestSrc, tpClub } from "@/lib/tp/proto/clubs";

/**
 * Arte de divulgação do Temporadas com os escudos REAIS encaixados nos
 * escudos em branco da ilustração (posições em CREST_SLOTS). Trocar o clube
 * não exige gerar a arte de novo.
 */
export function CrestArt({ art, clubs, className = "", eager = false }: { art: string; clubs: string[]; className?: string; eager?: boolean }) {
  const src = ART[art];
  const slots = CREST_SLOTS[art] ?? [];
  if (!src) return null;
  return (
    <div className={`relative ${className}`}>
      <img src={src} alt="" className="block h-auto w-full" loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />
      {slots.map((s, i) =>
        clubs[i] ? (
          <img
            key={i}
            src={crestSrc(clubs[i], s.w > 6 ? 128 : 48)}
            alt={tpClub(clubs[i]).name}
            title={tpClub(clubs[i]).name}
            className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_0_rgba(27,16,56,0.55)]"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%` }}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        ) : null,
      )}
    </div>
  );
}

/** Escudo real (48 px em listas, 128 px em destaque). */
export function TpCrest({ slug, size = 48, className = "" }: { slug: string; size?: 48 | 128; className?: string }) {
  return <img src={crestSrc(slug, size)} alt={tpClub(slug).name} className={`object-contain ${className}`} loading="lazy" decoding="async" draggable={false} />;
}
