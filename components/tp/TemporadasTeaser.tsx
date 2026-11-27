/* eslint-disable @next/next/no-img-element -- escudos já otimizados em WebP */
import Link from "next/link";
import { ArtImg } from "@/components/ui/ArtImg";
import { Icon } from "@/components/ui/Icon";
import { crestSrc } from "@/lib/tp/proto/clubs";

/** Atalho na sede do online: o modo carreira com clubes reais. */
export function TemporadasTeaser() {
  return (
    <Link
      href="/temporadas"
      className="flex items-center gap-3 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] p-3 text-[var(--ink)] shadow-[0_4px_0_var(--ink)] transition-transform active:translate-y-1 active:shadow-[0_1px_0_var(--ink)]"
    >
      <ArtImg name="icon-temporadas" className="h-12 w-12 shrink-0 object-contain" fallback={<Icon name="clipboard" className="h-10 w-10 shrink-0" />} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="t-heading">Temporadas</span>
          <span className="rounded bg-[var(--hot)] px-1 text-[0.6rem] font-extrabold uppercase text-white">novo</span>
        </span>
        <span className="block truncate text-xs font-bold opacity-70">Modo carreira com clubes reais, da Série D ao topo</span>
      </span>
      <span className="hidden shrink-0 -space-x-2 min-[400px]:flex">
        {["aguia-de-maraba", "vila-nova", "flamengo"].map((s) => (
          <img key={s} src={crestSrc(s, 48)} alt="" className="h-8 w-8 rounded-full bg-white object-contain p-0.5 ring-2 ring-[var(--ink)]" loading="lazy" />
        ))}
      </span>
      <Icon name="chevron-right" className="h-5 w-5 shrink-0" />
    </Link>
  );
}
