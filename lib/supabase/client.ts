"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * URL e chave PUBLICÁVEL do Supabase. As duas são públicas por natureza
 * (vão para o navegador de qualquer jeito); quem protege os dados são as
 * regras RLS do banco (supabase/migrations). Podem ser trocadas por
 * variáveis de ambiente na Vercel, se preferir.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://sochoqusshdywnbqvzxv.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_zY3twAQ_hRVp0Z809xhrpQ_2ygq39kR";

let client: SupabaseClient | null = null;

/** Cliente único do navegador. A sessão fica no localStorage do aparelho. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        // A troca do código pela sessão é feita explicitamente em /auth/callback.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
