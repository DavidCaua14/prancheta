"use client";

/**
 * Pede ao servidor para pontuar no ranking as rodadas já encerradas
 * (Edge Function score-round). Idempotente no servidor; aqui só evitamos
 * repetir pedidos na mesma sessão. Ao abrir: recupera rodadas encerradas
 * que ninguém pediu. Depois: agenda o pedido para o fim de cada rodada.
 */
import { useEffect } from "react";
import { MATCH_SETTLE_MS } from "@/lib/scoring";
import { supabase } from "@/lib/supabase/client";
import { serverNow } from "@/lib/time";

type Kind = "liga" | "copa";
const asked = new Set<string>();

export async function askScore(kind: Kind, id: number, round: number) {
  const k = `${kind}:${id}:${round}`;
  if (asked.has(k)) return;
  asked.add(k);
  const { error } = await supabase().functions.invoke("score-round", { body: { kind, id, round } });
  if (error) asked.delete(k); // tenta de novo numa próxima vez
}

/** Pontua as rodadas encerradas da liga/copa aberta na tela. */
export function useAutoScore(kind: Kind, id: number | null | undefined, kickoffs: readonly number[] | null | undefined) {
  const key = kickoffs?.join(",") ?? "";
  useEffect(() => {
    if (!id || !kickoffs?.length) return;
    let stop = false;
    const settle = MATCH_SETTLE_MS + 4_000;
    // ao abrir: o que já terminou e ainda não foi pontuado
    (async () => {
      const now = serverNow();
      const ended = kickoffs.map((k, i) => ({ r: i + 1, k })).filter((x) => now >= x.k + settle);
      if (!ended.length) return;
      const { data } = await supabase().rpc("scored", { p_kind: kind === "liga" ? 0 : 1, p_ref: id });
      const done = new Set(((data ?? []) as number[]).map(Number));
      // um pedido só: o servidor grava todas as rodadas encerradas que faltam
      const missing = ended.filter((x) => !done.has(x.r));
      if (!stop && missing.length) await askScore(kind, id, missing[missing.length - 1].r);
    })();
    // durante: no fim de cada rodada das próximas 6 horas (tela aberta)
    const now = serverNow();
    const timers = kickoffs
      .map((k, i) => ({ r: i + 1, at: k + settle }))
      .filter((x) => x.at > now && x.at - now < 6 * 3600_000)
      .map((x) => window.setTimeout(() => void askScore(kind, id, x.r), x.at - now));
    return () => {
      stop = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kickoffs comparados por valor (key)
  }, [kind, id, key]);
}
