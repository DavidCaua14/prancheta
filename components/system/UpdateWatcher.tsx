"use client";

import { useEffect, useState } from "react";
import { APP_VERSION, type VersionPayload } from "@/lib/version";

/** Intervalo entre verificações enquanto a aba está aberta. */
const CHECK_INTERVAL_MS = 60_000;

/**
 * Vigia de versão.
 *
 * O bundle carrega a versão com que foi gerado (APP_VERSION). De tempos em
 * tempos — e sempre que o jogador volta para a aba — perguntamos ao servidor
 * qual é a versão publicada. Se for diferente, travamos a tela com um aviso
 * e o único caminho é clicar em "Atualizar", que recarrega o jogo.
 *
 * Custo: um GET pequeno e estático por minuto por aba ativa; nada de banco.
 */
export function UpdateWatcher() {
  const [update, setUpdate] = useState<VersionPayload | null>(null);

  useEffect(() => {
    if (APP_VERSION === "dev") return;
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as VersionPayload;
        if (!stopped && data.version && data.version !== APP_VERSION) {
          setUpdate(data);
          stopped = true;
        }
      } catch {
        // Sem rede: tenta de novo no próximo ciclo.
      }
    }

    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    void check();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!update) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [update]);

  if (!update) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-title"
      aria-describedby="update-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(27,16,56,0.82)] p-4 backdrop-blur-sm"
    >
      <div className="panel halftone anim-pop relative w-full max-w-sm p-6 pt-14 text-center">
        <div className="absolute -top-10 left-1/2 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--sun)] shadow-[0_4px_0_var(--ink)]">
          <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
            <circle cx="24" cy="24" r="18" fill="#fff" stroke="var(--ink)" strokeWidth="3" />
            <path
              d="M24 10l6 5-2 7h-8l-2-7zM12 22l6 2 2 7-4 5-6-3M36 22l-6 2-2 7 4 5 6-3M20 31h8"
              fill="var(--ink)"
              stroke="var(--ink)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 id="update-title" className="t-heading text-2xl">
          Apito! Tem atualização
        </h2>
        <p id="update-desc" className="mt-3 font-bold">
          Saiu uma versão nova do Prancheta. Para continuar jogando, atualize o jogo.
        </p>
        {update.notes.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl border-[3px] border-[var(--ink)] bg-white px-4 py-3 text-left text-sm font-semibold">
            {update.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span aria-hidden className="text-[var(--grass-2)]">★</span>
                {note}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          autoFocus
          onClick={() => window.location.reload()}
          className="btn btn-green btn-lg mt-6 w-full"
        >
          Atualizar agora
        </button>
        <p className="mt-3 text-xs font-bold opacity-60">
          Seu clube está salvo. Leva só um segundinho.
        </p>
      </div>
    </div>
  );
}
