"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { clockAt, joinLeague, loadLeague, refreshChanges, type LeagueData } from "./data";


/** Dados da liga em memória (navegar entre telas não relê o banco). */
const memory = new Map<number, LeagueData>();

/** Relógio da tela: atualiza a cada `ms`. */
export function useNow(ms = 1000) {
  // começa em 0 (pré-renderização não pode ler o relógio) e liga no navegador
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura do relógio, só no navegador
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Clube + liga do técnico. Entra numa liga automaticamente quando precisa
 * (primeira vez ou temporada encerrada). Relê as mudanças ao vivo a cada 10 s
 * só enquanto há rodada em andamento, e a liga inteira quando uma rodada começa.
 */
export function useLeague({ autoJoin = true }: { autoJoin?: boolean } = {}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(
    async (opts: { forceJoin?: boolean } = {}) => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      let c = await getMyClub(s);
      if (!c) return router.replace("/clube/novo");
      if (!c.squad) return router.replace("/peneira");
      setSession(s);

      let d = c.league_id ? memory.get(c.league_id) : undefined;
      if (c.league_id && (!d || Date.now() - d.loadedAt > 120_000)) {
        try {
          d = await loadLeague(c.league_id);
          memory.set(c.league_id, d);
        } catch {
          d = undefined;
        }
      }
      const over = !c.league_id || !d || Date.now() > new Date(d.league.ends_at).getTime();
      if ((over && autoJoin) || opts.forceJoin) {
        setJoining(true);
        try {
          const id = await joinLeague();
          c = (await getMyClub(s, { fresh: true })) ?? c;
          d = await loadLeague(id);
          memory.set(id, d);
        } catch {
          setError("Não deu para entrar na liga agora. Tente de novo em instantes.");
        }
        setJoining(false);
      }
      setClub(c);
      setData(d ?? null);
    },
    [router, autoJoin],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial assíncrona
    void load();
  }, [load]);

  // rodada ao vivo: relê só as mudanças (pequeno) a cada 10 s
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(async () => {
      const c = clockAt(data, Date.now());
      if (!c.live) return;
      // a rodada começou depois da última leitura completa: relê escalações (valem as do apito)
      const next = data.loadedAt < data.kickoffs[c.live - 1] + 5_000 ? await loadLeague(data.league.id).catch(() => data) : await refreshChanges(data, c.live);
      memory.set(data.league.id, next);
      setData(next);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [data]);

  return { session, club, data, error, joining, reload: load, setData };
}
