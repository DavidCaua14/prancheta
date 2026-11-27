"use client";

import { useEffect, useMemo } from "react";

/**
 * Tela de erro do jogo (em vez de página em branco). Mostra a mensagem do erro
 * e o aparelho/navegador, para o jogador mandar um print. Se o erro for de
 * arquivo do site que mudou com uma atualização (ChunkLoadError), recarrega
 * sozinho uma vez.
 */
export default function GameError({ error, retry }: { error: unknown; retry: () => void }) {
  const err = useMemo(() => (error instanceof Error ? error : new Error(String(error))), [error]);
  const chunk = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${err.name} ${err.message}`);

  useEffect(() => {
    console.error(err);
    if (!chunk) return;
    try {
      if (sessionStorage.getItem("prancheta:recarregou") === location.pathname) return;
      sessionStorage.setItem("prancheta:recarregou", location.pathname);
    } catch {}
    location.reload();
  }, [err, chunk]);

  const where = typeof window === "undefined" ? "" : `${location.pathname} · ${navigator.userAgent}`;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--night)] px-5 py-10 text-center text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--red)] text-3xl font-extrabold shadow-[0_4px_0_var(--ink)]">!</span>
      <p className="t-heading text-2xl">Ops, algo deu errado nesta tela</p>
      <p className="max-w-md text-sm text-white/75">
        {chunk ? "O jogo foi atualizado. Recarregando..." : "Tente de novo. Se continuar, tire um print desta tela e mande para o suporte: a mensagem abaixo mostra o que aconteceu."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn btn-green">
          Tentar de novo
        </button>
        <button type="button" onClick={() => location.reload()} className="btn btn-paper">
          Recarregar
        </button>
        <a href="/jogo" className="btn btn-paper">
          Voltar ao início
        </a>
      </div>
      <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl border-[3px] border-[var(--ink)] bg-black/30 p-3 text-left text-[0.7rem] leading-snug text-white/80 sm:max-w-xl">
        {err.name}: {err.message}
        {"\n"}
        {(err.stack ?? "").split("\n").slice(1, 4).join("\n")}
        {"\n"}
        {where}
      </pre>
    </div>
  );
}
