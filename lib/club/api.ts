"use client";

import type { Session } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/lib/supabase/client";

export type Club = {
  id: string;
  name: string;
  tag: string;
  crest: string;
  kit: string;
  /** Escolhas da peneira ("1:0120..."); null até montar o elenco. */
  squad: string | null;
  /** Escalação e tática ("1:0:0123456789a:211:a9"); null = padrão da peneira. */
  lineup: string | null;
  /** Liga em que o clube joga (null = ainda não entrou) */
  league_id: number | null;
  league_slot: number | null;
  joined_round: number | null;
  /** Divisão atual (0 = Várzea, 1 = Série D...) — só o servidor muda. */
  division: number;
  /** XP acumulado das 14 cartas (null = todas no nível 1) — só o servidor muda. */
  xp: number[] | null;
};

const CLUB_CACHE = (uid: string) => `prancheta:club:${uid}`;

function readCache(uid: string): Club | null {
  try {
    const raw = localStorage.getItem(CLUB_CACHE(uid));
    const club = raw ? (JSON.parse(raw) as Club) : null;
    // cache de versão antiga (sem o campo squad) ou elenco ainda vazio: relê do banco
    return club && typeof club.squad === "string" && "lineup" in club && "xp" in club ? club : null;
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
  const { data, error } = await supabase().from("clubs").select("id,name,tag,crest,kit,squad,lineup,league_id,league_slot,joined_round,division,xp").eq("id", uid).maybeSingle();
  if (error) throw error;
  if (data) writeCache(data);
  return data;
}

export type CreateClubError = "name_taken" | "already_has_club" | "invalid" | "session" | "network";

export async function createClub(
  session: Session,
  input: Pick<Club, "name" | "tag" | "crest" | "kit">,
): Promise<{ club: Club } | { error: CreateClubError }> {
  const club: Club = { id: session.user.id, ...input, name: input.name.trim(), squad: null, lineup: null, league_id: null, league_slot: null, joined_round: null, division: 0, xp: null };
  const { error } = await supabase().from("clubs").insert({ ...input, id: club.id, name: club.name });
  if (!error) {
    writeCache(club);
    return { club };
  }
  if (error.code === "23505") {
    // chave duplicada: ou o nome já existe, ou este usuário já tem clube
    return error.message.includes("clubs_pkey") ? { error: "already_has_club" } : { error: "name_taken" };
  }
  if (error.code === "23514" || error.code === "22001") return { error: "invalid" };
  if (error.code === "42501" || error.code === "PGRST301" || error.code === "23503") return { error: "session" };
  return { error: "network" };
}

/**
 * Confere no servidor de login se a conta ainda existe (ex.: foi apagada).
 * Só é chamado na criação do clube, então custa 1 requisição por cadastro.
 * Se a conta não existir mais, limpa a sessão guardada no aparelho.
 */
export async function ensureValidUser(): Promise<boolean> {
  const { data, error } = await supabase().auth.getUser();
  if (data.user && !error) return true;
  // erro de rede: não desloga; conta inexistente/sessão inválida: desloga
  if (error && error.status && error.status >= 400 && error.status < 500) {
    await supabase().auth.signOut({ scope: "local" });
    return false;
  }
  return true;
}

/** Para onde mandar o usuário logado: criar clube ou entrar no jogo. */
export async function routeForSession(session: Session | null): Promise<string> {
  if (!session) return "/entrar";
  try {
    const club = await getMyClub(session);
    return !club ? "/clube/novo" : club.squad ? "/jogo" : "/peneira";
  } catch {
    return "/clube/novo";
  }
}

/**
 * Salva o elenco da peneira (1 escrita, uma única vez — o banco bloqueia refazer).
 */
export async function saveSquad(session: Session, club: Club, squad: string): Promise<{ club: Club } | { error: "locked" | "network" }> {
  const { data, error } = await supabase().from("clubs").update({ squad }).eq("id", session.user.id).select("squad").maybeSingle();
  if (error) return { error: error.code === "P0001" ? "locked" : "network" };
  if (!data) return { error: "network" };
  const saved = { ...club, squad: data.squad as string };
  writeCache(saved);
  return { club: saved };
}

/** Salva escalação e tática (1 escrita a cada "Salvar"). */
export async function saveLineup(session: Session, club: Club, lineup: string): Promise<{ club: Club } | { error: "network" }> {
  const { data, error } = await supabase().from("clubs").update({ lineup }).eq("id", session.user.id).select("lineup").maybeSingle();
  if (error || !data) return { error: "network" };
  const saved = { ...club, lineup: data.lineup as string };
  writeCache(saved);
  return { club: saved };
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
