"use client";

/**
 * Envia mudanças ao vivo (tática e substituição) pela RPC send_changes: o
 * SERVIDOR escolhe o minuto (agora + 4, pelo relógio dele) e grava tudo de
 * uma vez. Assim um relógio de celular/PC atrasado não faz a mudança "chegar
 * atrasada".
 */
import { supabase } from "@/lib/supabase/client";

export type SendResult = { ok: true; tick: number } | { ok: false; reason: "late" | "ended" | "auth" | "offline" | "other" };

export async function sendLiveChanges(scope: "liga" | "copa" | "amistoso", id: number, round: number, changes: string[]): Promise<SendResult> {
  try {
    const { data, error } = await supabase().rpc("send_changes", { p_scope: scope, p_id: id, p_round: round, p_changes: changes });
    if (!error && typeof data === "number") return { ok: true, tick: data };
    const code = error?.code ?? "";
    if (code === "P0016") return { ok: false, reason: "ended" };
    if (code === "28000" || code === "PGRST301" || /jwt/i.test(error?.message ?? "")) return { ok: false, reason: "auth" };
    // regra de segurança (minuto que já passou, limite de mudanças, jogo errado)
    if (code === "42501" || code === "P0015") return { ok: false, reason: "late" };
    if (!code && /fetch|network|failed/i.test(error?.message ?? "")) return { ok: false, reason: "offline" };
    return { ok: false, reason: "other" };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

/** Texto do aviso para cada resultado. */
export function sendMessage(r: SendResult): string {
  if (r.ok) return `Ok! Vale a partir do minuto ${Math.min(90, r.tick)}.`;
  switch (r.reason) {
    case "ended":
      return "O jogo já está acabando: não dá mais para mudar.";
    case "auth":
      return "Sua sessão expirou. Recarregue a página e tente de novo.";
    case "offline":
      return "Sem conexão agora. Confira a internet e tente de novo.";
    case "late":
      return "O servidor recusou a mudança (limite de 30 por jogo ou jogo encerrado).";
    default:
      return "Não deu para salvar agora. Tente de novo.";
  }
}
