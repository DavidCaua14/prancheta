import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const NAV = [
  { href: "#ao-vivo", label: "Ao vivo" },
  { href: "#cartas", label: "Cartas" },
  { href: "#ligas", label: "Ligas & Copas" },
  { href: "#leilao", label: "Leilão" },
  { href: "#amigos", label: "Amistosos" },
  { href: "#faq", label: "Dúvidas" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-4 border-[var(--toon-ink)] bg-[var(--toon-night-2)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link href="/" aria-label="Prancheta — início">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-sm font-black uppercase tracking-wide text-white/85 transition hover:bg-white/10 hover:text-[var(--toon-sun)]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <a href="#comecar" className="hidden text-sm font-black uppercase text-white/85 hover:text-[var(--toon-sun)] sm:inline">
            Entrar
          </a>
          <a href="#comecar" className="toon-btn !px-4 !py-2 text-sm">
            Jogar grátis
          </a>
        </div>
      </div>
      <nav aria-label="Seções" className="overflow-x-auto border-t-2 border-black/30 lg:hidden">
        <ul className="flex w-max gap-1 px-3 py-1.5">
          {NAV.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="block rounded-full px-3 py-1 text-xs font-black uppercase text-white/85">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
