"use client";

import { syncClock } from "@/lib/clock";
import { serverNow } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getMyClub, getSession, type Club } from "@/lib/club/api";
import { seasonBonus } from "@/lib/cards/evolution";
import { clubCards } from "@/lib/cards/squad";
import { clockAt, closeLeague, clubMatchXp, joinLeague, lastSeason, loadLeague, refreshChanges, type Evolved, type LeagueData, type SeasonResult, type SeasonRow } from "./data";

/** Dados da liga em memória (navegar entre telas não relê o banco). */
const memory = new Map<number, LeagueData>();
/** Resultado da temporada que acabou de fechar (até o técnico fechar o aviso). */
let pendingSeason: SeasonResult | null = null;

const SEEN = (clubId: string) => `prancheta:temporada-vista:${clubId}`;

function seenSeason(clubId: string): number {
  try {
    return Number(localStorage.getItem(SEEN(clubId)) ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Cartas que subiram de nível: recalcula o XP que a temporada deu (o mesmo
 * cálculo do servidor) e compara o elenco antes e depois.
 */
function seasonResult(row: SeasonRow, club: Club, old: LeagueData | undefined): SeasonResult {
  if (!old || !club.xp) return { ...row, evolved: [], xp: 0 };
  const bonus = seasonBonus(row.pos, row.move);
  const gained = clubMatchXp(old, club.id, Number.POSITIVE_INFINITY).xp.map((v) => Math.min(3000, v) + bonus);
  const before = club.xp.map((v, i) => Math.max(0, v - gained[i]));
  const a = clubCards(club.id, club.squad, before, club.won);
  const b = clubCards(club.id, club.squad, club.xp, club.won);
  const evolved: Evolved[] = [];
  b.forEach((c, i) => {
    if (c.level > a[i].level) evolved.push({ name: c.name, position: c.position, from: a[i].level, to: c.level, overall: c.overall, gain: c.overall - a[i].overall });
  });
  evolved.sort((x, y) => y.to - y.from - (x.to - x.from) || y.overall - x.overall);
  return { ...row, evolved, xp: gained.reduce((s, v) => s + v, 0) };
}

/** Relógio da tela: atualiza a cada `ms`. */
export function useNow(ms = 1000) {
  // começa em 0 (pré-renderização não pode ler o relógio) e liga no navegador
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primeira leitura do relógio, só no navegador
    setNow(serverNow());
    // relógio do servidor: o minuto da partida é o mesmo em todo aparelho
    void syncClock().then(() => setNow(serverNow()));
    const id = window.setInterval(() => setNow(serverNow()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Clube + liga do técnico. Quando a temporada acaba, pede ao servidor para
 * fechá-la (acesso/rebaixamento), mostra o resultado e entra na liga da nova
 * divisão. Relê as mudanças ao vivo a cada 10 s só enquanto há rodada em
 * andamento, e a liga inteira quando uma rodada começa.
 */
export function useLeague({ autoJoin = true }: { autoJoin?: boolean } = {}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [season, setSeason] = useState<SeasonResult | null>(pendingSeason);

  const load = useCallback(
    async (opts: { forceJoin?: boolean; fresh?: boolean } = {}) => {
      const s = await getSession();
      if (!s) return router.replace("/entrar");
      let c = await getMyClub(s, { fresh: opts.fresh });
      if (!c) return router.replace("/clube/novo");
      if (!c.squad) return router.replace("/peneira");
      setSession(s);
      setError(null);

      let d = c.league_id ? memory.get(c.league_id) : undefined;
      if (c.league_id && (!d || serverNow() - d.loadedAt > 120_000)) {
        try {
          d = await loadLeague(c.league_id);
          memory.set(c.league_id, d);
        } catch {
          d = undefined;
        }
      }
      const over = !c.league_id || !d || serverNow() > new Date(d.league.ends_at).getTime();
      if ((over && autoJoin) || opts.forceJoin) {
        setJoining(true);
        const prev = c.league_id;
        const oldData = d;
        try {
          // temporada acabou: o servidor recalcula a tabela e decide quem sobe/cai
          if (prev && d && !d.league.closed_at && serverNow() > new Date(d.league.ends_at).getTime()) {
            await closeLeague(prev);
          }
          const id = await joinLeague();
          c = (await getMyClub(s, { fresh: true })) ?? c;
          if (prev && prev !== id) {
            memory.delete(prev);
            const last = await lastSeason(c.id);
            if (last && last.league_id === prev && seenSeason(c.id) < last.league_id) {
              const result = seasonResult(last, c, oldData);
              pendingSeason = result;
              setSeason(result);
            }
          }
          d = await loadLeague(id);
          memory.set(id, d);
        } catch (e) {
          const code = (e as { code?: string })?.code;
          setError(
            code === "P0003"
              ? "Fechando a tabela da temporada... Tente de novo em alguns segundos."
              : "Não deu para entrar na liga agora. Tente de novo em instantes.",
          );
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

  // fim da temporada com a tela aberta: fecha e vai para a próxima sozinho
  useEffect(() => {
    if (!data || !autoJoin) return;
    const wait = new Date(data.league.ends_at).getTime() - serverNow() + 2_000;
    if (wait <= 0 || wait > 86400_000) return;
    const id = window.setTimeout(() => void load(), wait);
    return () => window.clearTimeout(id);
  }, [data, autoJoin, load]);

  // rodada ao vivo: relê só as mudanças (pequeno) a cada 10 s
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(async () => {
      const c = clockAt(data, serverNow());
      if (!c.live) return;
      // a rodada começou depois da última leitura completa: relê escalações (valem as do apito)
      const next = data.loadedAt < data.kickoffs[c.live - 1] + 5_000 ? await loadLeague(data.league.id).catch(() => data) : await refreshChanges(data, c.live);
      memory.set(data.league.id, next);
      setData(next);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [data]);

  const dismissSeason = useCallback(() => {
    if (season && club) {
      try {
        localStorage.setItem(SEEN(club.id), String(season.league_id));
      } catch {
        // sem armazenamento: o aviso some só nesta sessão
      }
    }
    pendingSeason = null;
    setSeason(null);
  }, [season, club]);

  return { session, club, data, error, joining, reload: load, setData, season, dismissSeason };
}
