import { Logo } from "@/components/ui/Logo";
import { MobileMenu } from "./MobileMenu";
import { NAV } from "./nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-[var(--ink)] bg-[var(--night-2)]">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#topo" aria-label="Prancheta — início" className="shrink-0">
          <Logo />
        </a>
        <nav aria-label="Principal" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-[0.95rem] font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <a href="#comecar" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            Entrar
          </a>
          <a href="#comecar" className="btn btn-green btn-sm hidden min-[430px]:inline-flex">
            Jogar grátis
          </a>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
