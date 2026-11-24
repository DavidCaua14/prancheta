import Link from "next/link";
import type { ReactNode } from "react";
import { Art } from "@/components/ui/Art";
import { Logo } from "@/components/ui/Logo";

/**
 * Moldura das telas do jogo (login, criação de clube, sede):
 * estádio ao fundo, logo no topo e o conteúdo centralizado.
 */
export function GameShell({ children, topRight }: { children: ReactNode; topRight?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <Art
          name="bg-jogo"
          width={1672}
          height={941}
          eager
          sizes="100vw"
          className="h-full w-full object-cover"
          fallback={
            <Art
              name="hero-stadium"
              width={1672}
              height={941}
              eager
              sizes="100vw"
              className="h-full w-full object-cover object-right"
              fallback={<div className="h-full w-full bg-[var(--night)]" />}
            />
          }
        />
        <div className="absolute inset-0 bg-[rgba(29,22,80,0.55)]" />
      </div>

      <header className="relative z-20 flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Voltar para o início">
          <Logo />
        </Link>
        {topRight}
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-4 pb-10 sm:px-6">{children}</main>
    </div>
  );
}
