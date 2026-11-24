"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, routeForSession } from "@/lib/club/api";
import { supabase } from "@/lib/supabase/client";

/**
 * Volta do Google: troca o código pela sessão (fica salva no aparelho) e
 * manda o técnico para a criação do clube ou direto para o jogo.
 */
export function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      try {
        if (params.get("error")) throw new Error(params.get("error_description") ?? "oauth");
        if (code) {
          const { error } = await supabase().auth.exchangeCodeForSession(code);
          if (error) {
            // Código já usado (ex.: recarregou a página)? Se a sessão existe, segue o jogo.
            if (!(await getSession())) throw error;
          }
        }
        const session = await getSession();
        if (!session) throw new Error("sem sessão");
        if (alive) router.replace(await routeForSession(session));
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
      <div className="panel w-full px-6 py-8">
        {failed ? (
          <>
            <p className="t-heading text-xl">Não deu para entrar</p>
            <p className="mt-2 text-sm opacity-75">O login foi cancelado ou expirou. Tente de novo.</p>
            <Link href="/entrar?erro=1" className="btn btn-green mt-5 w-full">
              Tentar de novo
            </Link>
          </>
        ) : (
          <>
            <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[var(--ink)] border-t-[var(--sun)]" />
            <p className="t-heading mt-4 text-xl">Entrando em campo...</p>
            <p className="mt-1 text-sm opacity-70">Preparando o vestiário.</p>
          </>
        )}
      </div>
    </div>
  );
}
