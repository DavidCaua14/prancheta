/**
 * Edge Function: fecha uma edição de copa.
 *
 * Recalcula o mata-mata inteiro com o mesmo código do jogo (lib/cup/core) e
 * grava a fase alcançada por cada vaga via close_cup(), que também paga os
 * prêmios em moedas. Idempotente: copa já fechada só devolve o campeão.
 * Empacotada com esbuild (npm run fn:build) e publicada com npm run fn:deploy.
 */
import { buildCupData, CUP_COLS, cupReach, cupStats, ENTRY_COLS, type CupEntry, type CupRow } from "../../../lib/cup/core";
import { LOT_COLS, type LotRow } from "../../../lib/league/core";

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
    id = Number((await req.json()).cup_id);
  } catch {
    return reply(400, { error: "json inválido" });
  }
  if (!Number.isSafeInteger(id) || id <= 0) return reply(400, { error: "cup_id inválido" });

  try {
    const cups = await rest<CupRow[]>(`cups?id=eq.${id}&select=${CUP_COLS}`);
    const cup = cups[0];
    if (!cup) return reply(404, { error: "copa não encontrada" });
    if (cup.closed_at) return reply(200, { cup_id: id, champion: cup.champion, closed: true });
    if (new Date(cup.ends_at).getTime() > Date.now()) return reply(409, { error: "copa em andamento" });

    const [entries, changes] = await Promise.all([
      rest<CupEntry[]>(`cup_entries?cup_id=eq.${id}&select=${encodeURIComponent(ENTRY_COLS)}`),
      rest<{ round: number; club_id: string; tick: number; change: string }[]>(`cup_changes?cup_id=eq.${id}&select=round,club_id,tick,change`),
    ]);
    const ids = entries.map((e) => e.club_id);
    const [logs, lots] = ids.length
      ? await Promise.all([
          rest<{ club_id: string; at: string; lineup: string }[]>("rpc/lineup_log_window", { method: "POST", body: JSON.stringify({ p_clubs: ids, p_from: cup.starts_at }) }),
          rest<LotRow[]>(`auction_lots?best_club=in.(${ids.join(",")})&ends_at=lt.${encodeURIComponent(cup.ends_at)}&select=${LOT_COLS}`),
        ])
      : [[], []];

    const data = buildCupData({ cup, entries, logs, changes, lots });
    const reach = cupReach(data);
    // números de cada vaga com técnico (alimentam os eventos semanais)
    const stats: Record<string, unknown> = {};
    for (const e of entries) stats[String(e.slot)] = cupStats(data, e.slot);
    const champion = await rest<number>("rpc/close_cup", { method: "POST", body: JSON.stringify({ p_cup: id, p_reach: reach, p_stats: stats }) });
    return reply(200, { cup_id: id, champion, closed: true });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "falha ao fechar a copa" });
  }
});
