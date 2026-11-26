/**
 * Edge Function: pontua no ranking as rodadas encerradas de uma liga (ou fases
 * de copa) logo depois que terminam. Recalcula os jogos com o mesmo código do
 * jogo e grava o resultado de cada técnico real (match_points).
 *
 * Um pedido grava TODAS as rodadas encerradas que faltam (teste com 50
 * técnicos: pedir rodada por rodada gerava centenas de chamadas repetidas).
 * Se não falta nenhuma, responde na hora sem carregar a liga. Idempotente;
 * o resultado não depende de quem pediu.
 */
import { CUP_ROUND_GAP_MS, roundsOf } from "../../../lib/cup/core";
import { MATCH_SETTLE_MS } from "../../../lib/scoring";
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
    // tudo o que já terminou está gravado? sai sem carregar a liga/copa
    const done = new Set(await rest<number[]>("rpc/scored", { method: "POST", body: JSON.stringify({ p_kind: kind, p_ref: id }) }));
    const now = Date.now();
    let ended: number[];
    if (kind === 0) {
      const rounds = await rest<{ round: number; kickoff: string }[]>(`league_rounds?league_id=eq.${id}&select=round,kickoff`);
      ended = rounds.filter((r) => now >= new Date(r.kickoff).getTime() + MATCH_SETTLE_MS).map((r) => r.round);
    } else {
      const cups = await rest<{ starts_at: string; size: number }[]>(`cups?id=eq.${id}&select=starts_at,size`);
      if (!cups[0]) return reply(404, { error: "copa não encontrada" });
      const start = new Date(cups[0].starts_at).getTime();
      ended = Array.from({ length: roundsOf(cups[0].size) }, (_, i) => i + 1).filter((r) => now >= start + (r - 1) * CUP_ROUND_GAP_MS + MATCH_SETTLE_MS);
    }
    if (!ended.includes(round) && !done.has(round)) return reply(409, { error: "rodada ainda não terminou" });
    if (ended.every((r) => done.has(r))) return reply(200, { scored: true, cached: true });
    if (kind === 0) {
      const league = await loadLeagueRow(id);
      if (!league) return reply(404, { error: "liga não encontrada" });
      const { data } = await loadLeagueData(league);
      const n = await recordLeagueRounds(data);
      return reply(200, { scored: true, rounds: n });
    }
    const cup = await loadCupRow(id);
    if (!cup) return reply(404, { error: "copa não encontrada" });
    const { data } = await loadCupData(cup, new Date().toISOString());
    const n = await recordCupRounds(data);
    return reply(200, { scored: true, rounds: n });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "falha ao pontuar" });
  }
});
