/**
 * Edge Function: pontua no ranking uma rodada da liga (ou fase de copa)
 * logo depois que ela termina. Recalcula os jogos com o mesmo código do jogo
 * e grava o resultado de cada técnico real (match_points). Idempotente:
 * rodada já gravada não é recalculada. Qualquer aparelho pode pedir; o
 * resultado não depende de quem pediu.
 */
import { CORS, loadCupData, loadCupRow, loadLeagueData, loadLeagueRow, recordCupRounds, recordLeagueRounds, reply, rest } from "../_shared/game";

declare const Deno: { serve(h: (req: Request) => Response | Promise<Response>): void };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "use POST" });
  let body: { kind?: string; id?: number; round?: number };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "json inválido" });
  }
  const id = Number(body.id);
  const round = Number(body.round);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(round) || round < 1 || round > 40) return reply(400, { error: "parâmetros inválidos" });
  const kind = body.kind === "copa" ? 1 : body.kind === "liga" ? 0 : -1;
  if (kind < 0) return reply(400, { error: "kind inválido" });

  try {
    // já gravada? sai sem carregar nada
    const done = await rest<number[]>("rpc/scored", { method: "POST", body: JSON.stringify({ p_kind: kind, p_ref: id }) });
    if (done.includes(round)) return reply(200, { scored: true, cached: true });
    if (kind === 0) {
      const league = await loadLeagueRow(id);
      if (!league) return reply(404, { error: "liga não encontrada" });
      const { data } = await loadLeagueData(league);
      const n = await recordLeagueRounds(data, round);
      return reply(200, { scored: n > 0 });
    }
    const cup = await loadCupRow(id);
    if (!cup) return reply(404, { error: "copa não encontrada" });
    const { data } = await loadCupData(cup, new Date().toISOString());
    const n = await recordCupRounds(data, round);
    return reply(200, { scored: n > 0 });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "falha ao pontuar" });
  }
});
