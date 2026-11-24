"use client";

import { useState } from "react";
import { NAV } from "./nav";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border-[3px] border-[var(--ink)] bg-[var(--night-3)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Menu"
          className="absolute inset-x-0 top-full border-b-[3px] border-[var(--ink)] bg-[var(--night-2)] px-4 pb-5 pt-2 shadow-[0_8px_0_rgba(0,0,0,0.25)]"
        >
          <ul className="grid gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-lg font-bold text-white/90 hover:bg-white/10"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a href="#comecar" onClick={() => setOpen(false)} className="btn btn-green w-full">
              Jogar grátis
            </a>
            <a href="#comecar" onClick={() => setOpen(false)} className="btn btn-ghost w-full">
              Entrar
            </a>
          </div>
        </nav>
      )}
    </div>
  );
}
