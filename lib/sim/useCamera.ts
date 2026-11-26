"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "prancheta:camera";

/**
 * Câmera da partida: desligada por padrão (placar + lances escritos);
 * ligada mostra o quadro animado. A escolha fica salva no aparelho.
 */
export function useCamera() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a preferência salva uma vez (evita divergência no prerender)
      if (localStorage.getItem(KEY) === "1") setOn(true);
    } catch {}
  }, []);
  const toggle = useCallback(() => {
    setOn((v) => {
      try {
        localStorage.setItem(KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }, []);
  return [on, toggle] as const;
}
