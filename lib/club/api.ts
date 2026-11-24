"use client";

import type { Session } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/lib/supabase/client";

export type Club = {
  id: string;
  name: string;
  tag: string;
  crest: string;
  kit: string;
};

const CLUB_CACHE = (uid: string) => `prancheta:club:${uid}`;

function readCache(uid: string): Club | null {
  try {
    const raw = localStorage.getItem(CLUB_CACHE(uid));
    return raw ? (JSON.parse(raw) as Club) : null;
  } catch {
    return null;
  }
}

function writeCache(club: Club) {
  try {
    localStorage.setItem(CLUB_CACHE(club.id), JSON.stringify(club));
  } catch {
    // sem armazenamento local: tudo bem, só lê do banco de novo na próxima
  }
}

/** Sessão salva no aparelho (não consulta o servidor se o token ainda vale). */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}

/**
 * Clube do usuário logado. Lê do cache local primeiro: depois do primeiro
 * acesso, abrir o jogo não gasta nenhuma leitura no banco.
 */
export async function getMyClub(session: Session, { fresh = false } = {}): Promise<Club | null> {
  const uid = session.user.id;
  if (!fresh) {
    const cached = readCache(uid);
    if (cached) return cached;
  }
  const { data, error } = await supabase().from("clubs").select("id,name,tag,crest,kit").eq("id", uid).maybeSingle();
  if (error) throw error;
  if (data) writeCache(data);
  return data;
}

export type CreateClubError = "name_taken" | "already_has_club" | "invalid" | "session" | "network";

export async function createClub(
  session: Session,
  input: Omit<Club, "id">,
): Promise<{ club: Club } | { error: CreateClubError }> {
  const club: Club = { id: session.user.id, ...input, name: input.name.trim() };
  const { error } = await supabase().from("clubs").insert(club);
  if (!error) {
    writeCache(club);
    return { club };
  }
  if (error.code === "23505") {
    // chave duplicada: ou o nome já existe, ou este usuário já tem clube
    return error.message.includes("clubs_pkey") ? { error: "already_has_club" } : { error: "name_taken" };
  }
  if (error.code === "23514" || error.code === "22001") return { error: "invalid" };
  if (error.code === "42501" || error.code === "PGRST301") return { error: "session" };
  return { error: "network" };
}

/** Para onde mandar o usuário logado: criar clube ou entrar no jogo. */
export async function routeForSession(session: Session | null): Promise<string> {
  if (!session) return "/entrar";
  try {
    const club = await getMyClub(session);
    return club ? "/jogo" : "/clube/novo";
  } catch {
    return "/clube/novo";
  }
}

/**
 * Confere (sem login) se o provedor Google está ligado no Supabase,
 * para mostrar uma mensagem clara em vez de uma página de erro.
 */
export async function isGoogleEnabled(): Promise<boolean | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
    if (!res.ok) return null;
    const json = (await res.json()) as { external?: Record<string, boolean> };
    return Boolean(json.external?.google);
  } catch {
    return null;
  }
}

export async function signInWithGoogle() {
  return supabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
}

export async function signOut() {
  const { data } = await supabase().auth.getSession();
  if (data.session) {
    try {
      localStorage.removeItem(CLUB_CACHE(data.session.user.id));
    } catch {}
  }
  await supabase().auth.signOut();
}
