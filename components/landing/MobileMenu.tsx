"use client";

import { useEffect, useRef } from "react";
import { NAV } from "./nav";

/**
 * Menu do celular feito com <details>: abre e fecha nativamente, mesmo que o
 * JavaScript ainda não tenha carregado. O JS só melhora: fecha ao escolher um
 * link, ao tocar fora ou ao apertar Esc.
 */
export function MobileMenu() {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => el.removeAttribute("open");
    const onDoc = (e: Event) => {
      if (el.open && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const close = () => ref.current?.removeAttribute("open");

  return (
    <details ref={ref} className="group xl:hidden">
      <summary
        aria-label="Menu"
        className="flex h-[38px] w-[38px] cursor-pointer list-none items-center justify-center rounded-[11px] border-[3px] border-[var(--ink)] bg-[var(--night-3)] [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 group-open:hidden" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 24 24" className="hidden h-5 w-5 group-open:block" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </summary>
      <nav
        aria-label="Menu"
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b-[3px] border-[var(--ink)] bg-[var(--night-2)] px-4 pb-5 pt-2 shadow-[0_8px_0_rgba(0,0,0,0.25)]"
      >
        <ul className="grid gap-1">
          {NAV.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={close}
                className="block rounded-xl px-3 py-3 text-lg font-bold text-white/90 hover:bg-white/10"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href="/entrar" onClick={close} className="btn btn-green w-full">
            Jogar grátis
          </a>
          <a href="/entrar" onClick={close} className="btn btn-ghost w-full">
            Entrar
          </a>
        </div>
      </nav>
    </details>
  );
}
