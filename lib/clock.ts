"use client";

/**
 * Relógio do jogo acertado pelo do servidor.
 *
 * As partidas ao vivo andam pelo relógio: se o do celular/PC estiver
 * atrasado ou adiantado, a tela mostraria outro minuto. Na primeira leitura
 * perguntamos a hora ao servidor (server_now) e guardamos a diferença.
 */
import { supabase } from "@/lib/supabase/client";
import { setClockOffset } from "@/lib/time";

export { clockOffset, serverNow } from "@/lib/time";

let syncing: Promise<void> | null = null;

/** Acerta o relógio uma vez por sessão (ou de novo com `force`). */
export function syncClock(force = false): Promise<void> {
  if (syncing && !force) return syncing;
  syncing = (async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await supabase().rpc("server_now");
      const t1 = Date.now();
      if (error || !data) return;
      const server = new Date(data as string).getTime();
      // ignora respostas lentas demais (o meio do caminho fica impreciso)
      if (Number.isFinite(server) && t1 - t0 < 5_000) setClockOffset(server - (t0 + t1) / 2);
    } catch {
      // sem rede: segue com o relógio do aparelho
    }
  })();
  return syncing;
}
