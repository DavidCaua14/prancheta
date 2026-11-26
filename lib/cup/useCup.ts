"use client";

import { serverNow } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { MAX_TICKS, TICK_SECONDS } from "@/lib/league/core";
import { useAutoScore } from "@/lib/score-client";
import { closeCup, joinCup, loadCup, loadCupHome, refreshCupChanges, type CupData, type MyEntry, type Title } from "./data";

/** Dados em memória (ir e voltar entre a chave e o jogo não relê o banco). */
const memory = new Map<number, CupData>();

/** Duração máxima de um jogo (90 + acréscimos). */
export const MATCH_MS = MAX_TICKS * TICK_SECONDS * 1000;

/** Fase em andamento (1..n) ou null. */
export function liveRound(data: CupData, now: number): number | null {
  const r = data.kickoffs.findIndex((k) => now >= k && now < k + MATCH_MS);
  return r < 0 ? null : r + 1;
}

/** A fase `round` já terminou (todos os jogos)? */
export function roundOver(data: CupData, round: number, now: number) {
  return round >= 1 && now >= data.kickoffs[round - 1] + MATCH_MS;
}

/**
 * Os confrontos da fase já podem ser mostrados? Só quando a fase anterior
 * terminou E os dados foram lidos depois disso — antes, o "vencedor" seria
 * um palpite calculado sem as últimas mudanças dos técnicos.
 */
export function pairsKnown(data: CupData, round: number, now: number) {
  if (round === 1) return true;
  const end = data.kickoffs[round - 2] + MATCH_MS;
  return now >= end && data.loadedAt >= end;
}

/** O placar da fase já pode ser mostrado (dados lidos depois do apito)? */
export function scoresKnown(data: CupData, round: number, now: number) {
  const k = data.kickoffs[round - 1];
  return now >= k && data.loadedAt >= k && pairsKnown(data, round, now);
}

/**
 * Clube + inscrição + dados da copa. Quando a edição acaba, pede ao servidor
 * para fechá-la (prêmios) antes de mostrar o resultado.
 */
export function useCup(kind = 0) {
  const router = useRouter();
  const [club, setClub] = useState<Club | null>(null);
  const [entry, setEntry] = useState<MyEntry | null>(null);
  const [data, setData] = useState<CupData | null>(null);
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<Title | null | undefined>(undefined);

  const load = useCallback(
    async (opts: { fresh?: boolean } = {}) => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      // a inscrição e a copa só precisam do id do técnico: saem junto com o clube (cache)
      const cached = opts.fresh ? undefined : [...memory.values()].find((d) => d.cup.kind === kind && serverNow() - d.loadedAt <= 120_000);
      const early = loadCupHome(kind, s.user.id, cached?.cup.id);
      early.catch(() => {});
      const c = await getMyClub(s, { fresh: opts.fresh });
      if (!c) return router.replace("/clube/novo");
      if (!c.squad) return router.replace("/peneira");
      setClub(c);
      try {
        let home = await early;
        let e = home.entry;
        if (e && !e.cups.closed_at && serverNow() > new Date(e.cups.ends_at).getTime()) {
          await closeCup(e.cup_id);
          home = await loadCupHome(kind, c.id, cached?.cup.id);
          e = home.entry;
          setClub((await getMyClub(s, { fresh: true })) ?? c);
        }
        setEntry(e);
        if (home.title !== undefined) setTitle(home.title);
        // mostra a chave da edição atual e da que acabou há menos de 12 h
        if (e && serverNow() < new Date(e.cups.ends_at).getTime() + 12 * 3600_000) {
          let d = home.data ?? (cached?.cup.id === e.cup_id ? cached : undefined);
          if (!d) d = await loadCup(e.cup_id);
          memory.set(e.cup_id, d);
          setData(d);
        } else {
          setData(null);
        }
        setError(null);
      } catch {
        setError("Não deu para carregar a copa. Tente de novo em instantes.");
      }
      setReady(true);
    },
    [router, kind],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona
    void load();
  }, [load]);

  const join = useCallback(async () => {
    setJoining(true);
    try {
      await joinCup(kind);
      await load({ fresh: true });
    } catch {
      setError("Não deu para fazer a inscrição agora. Tente de novo.");
    }
    setJoining(false);
  }, [kind, load]);

  // fase ao vivo: relê as mudanças a cada 10 s; no apito de cada fase, relê tudo (escalações do apito)
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(async () => {
      const now = serverNow();
      const r = liveRound(data, now);
      if (!r) return;
      const next = data.loadedAt < data.kickoffs[r - 1] + 5_000 ? await loadCup(data.cup.id).catch(() => data) : await refreshCupChanges(data, r);
      memory.set(data.cup.id, next);
      setData(next);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [data]);

  // apito e fim de cada fase: relê a copa (escalações do apito, mudanças até o último minuto)
  useEffect(() => {
    if (!data) return;
    const now = serverNow();
    const moments = data.kickoffs.flatMap((k) => [k + 2_000, k + MATCH_MS + 2_000]).filter((t) => t > now);
    if (!moments.length) return;
    const wait = Math.min(...moments) - now;
    if (wait > 86400_000) return;
    const id = window.setTimeout(async () => {
      const next = await loadCup(data.cup.id).catch(() => null);
      if (next) {
        memory.set(next.cup.id, next);
        setData(next);
      }
    }, wait);
    return () => window.clearTimeout(id);
  }, [data]);

  // fim da copa com a tela aberta: fecha e mostra o resultado
  useEffect(() => {
    if (!data || data.cup.closed_at) return;
    const wait = new Date(data.cup.ends_at).getTime() - serverNow() + 3_000;
    if (wait <= 0 || wait > 86400_000) return;
    const id = window.setTimeout(() => void load({ fresh: true }), wait);
    return () => window.clearTimeout(id);
  }, [data, load]);

  const update = useCallback((d: CupData) => {
    memory.set(d.cup.id, d);
    setData(d);
  }, []);

  // ranking: pontua cada fase logo depois do apito final
  useAutoScore("copa", data?.cup.id, data?.kickoffs);

  return { club, entry, data, title, ready, joining, error, join, reload: load, setData: update };
}
