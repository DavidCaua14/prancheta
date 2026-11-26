"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

/** Intervalo do sinal de "estou online" com a aba visível. */
const EVERY_MS = 60_000;
/** Troca de tela não manda outro sinal se o último foi há menos que isso. */
const MIN_GAP_MS = 20_000;

/**
 * Presença para o painel admin: com a aba visível e o técnico logado, avisa
 * o banco a cada minuto (e ao trocar de tela) em qual tela está. Uma escrita
 * pequena por minuto por jogador; aba escondida não manda nada.
 */
export function PresencePing() {
  const path = usePathname();
  const last = useRef(0);
  const screen = useRef(path);

  useEffect(() => {
    screen.current = path;
    let stop = false;
    const send = async (force = false) => {
      if (stop || document.visibilityState !== "visible") return;
      if (!force && Date.now() - last.current < MIN_GAP_MS) return;
      // só quem está logado (a sessão salva no aparelho; não consulta o servidor)
      const { data } = await supabase().auth.getSession();
      if (!data.session || stop) return;
      last.current = Date.now();
      await supabase().rpc("ping", { p_screen: screen.current });
    };
    void send();
    const id = window.setInterval(() => void send(true), EVERY_MS);
    const onVis = () => void send();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path]);

  return null;
}
