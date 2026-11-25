/**
 * Edge Function: fecha a temporada de uma liga.
 *
 * Recalcula TODOS os jogos com o mesmo código do jogo (lib/league/core) e
 * grava a ordem final via close_league() — quem sobe e quem cai sai daqui,
 * assim como o XP que cada carta ganhou nos jogos (evolução das cartas),
 * nunca do aparelho do jogador. É idempotente: liga já fechada só devolve
 * o resultado guardado.
 *
 * Este arquivo é empacotado com esbuild (npm run fn:build) porque importa
 * o código do jogo; o deploy envia o pacote pronto (npm run fn:deploy).
 */
import { buildLeagueData, CLUB_COLS, clubMatchXp, finalCode, finalTable, LEAGUE_COLS, logsSince, type LeagueClub, type LeagueRow } from "../../../lib/league/core";

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void };

const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "use POST" });

  let id: number;
  try {
    id = Number((await req.json()).league_id);
  } catch {
    return reply(400, { error: "json inválido" });
  }
  if (!Number.isSafeInteger(id) || id <= 0) return reply(400, { error: "league_id inválido" });

  try {
    const leagues = await rest<LeagueRow[]>(`leagues?id=eq.${id}&select=${LEAGUE_COLS}`);
    const league = leagues[0];
    if (!league) return reply(404, { error: "liga não encontrada" });
    if (league.closed_at) return reply(200, { league_id: id, final: league.final, closed: true });
    if (new Date(league.ends_at).getTime() > Date.now()) return reply(409, { error: "temporada em andamento" });

    const [rounds, clubs, changes] = await Promise.all([
      rest<{ round: number; kickoff: string }[]>(`league_rounds?league_id=eq.${id}&select=round,kickoff&order=round`),
      rest<LeagueClub[]>(`clubs?league_id=eq.${id}&select=${CLUB_COLS}`),
      rest<{ round: number; club_id: string; tick: number; change: string }[]>(`match_changes?league_id=eq.${id}&select=round,club_id,tick,change`),
    ]);
    const ids = clubs.map((c) => c.id);
    const logs = ids.length
      ? await rest<{ club_id: string; at: string; lineup: string }[]>(
          `lineup_log?club_id=in.(${ids.join(",")})&at=gte.${encodeURIComponent(logsSince(league))}&select=club_id,at,lineup&order=at`,
        )
      : [];

    const data = buildLeagueData({ league, rounds, clubs, logs, changes });
    const table = finalTable(data);
    const points = Array.from({ length: league.size }, (_, slot) => table.find((r) => r.slot === slot)!.p);
    const xp: Record<string, number[]> = {};
    for (const c of clubs) xp[c.id] = clubMatchXp(data, c.id, Number.POSITIVE_INFINITY).xp;
    const final = await rest<string>("rpc/close_league", {
      method: "POST",
      body: JSON.stringify({ p_league: id, p_final: finalCode(table), p_points: points, p_xp: xp }),
    });
    return reply(200, { league_id: id, final, closed: true });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "falha ao fechar a temporada" });
  }
});
