"use client";

/**
 * Painel administrativo: leituras e ações (RPCs admin_* em
 * supabase/migrations/0038_admin.sql). O banco confere se quem chama é admin
 * em TODA chamada — esconder a tela no app é só conforto, não segurança.
 */
import { supabase } from "@/lib/supabase/client";

const ADMIN_FLAG = (uid: string) => `prancheta:admin:${uid}`;

/** É admin? Pergunta ao banco uma vez e guarda no aparelho (só para mostrar o botão). */
export async function checkAdmin(uid: string, { fresh = false } = {}): Promise<boolean> {
  if (!fresh) {
    try {
      const v = localStorage.getItem(ADMIN_FLAG(uid));
      if (v !== null) return v === "1";
    } catch {
      // sem armazenamento: pergunta ao banco
    }
  }
  const { data, error } = await supabase().rpc("is_admin");
  if (error) return false;
  try {
    localStorage.setItem(ADMIN_FLAG(uid), data ? "1" : "0");
  } catch {
    // tudo bem
  }
  return !!data;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export type DayPoint = { day: string; signups: number; active: number };
export type Overview = {
  now: string;
  users: { total: number; new_24h: number; new_7d: number; no_club: number; no_squad: number; online: number; active_1d: number; active_7d: number; active_30d: number };
  series: DayPoint[];
  divisions: { division: number; clubs: number; coins: number }[];
  economy: {
    coins_total: number;
    coins_avg: number;
    coins_max: number;
    auction_24h: number;
    auction_sold_24h: number;
    auction_open: number;
    auction_bids_open: number;
    events_7d: number;
    home_7d: number;
    league_prizes_7d: number;
    cup_prizes_7d: number;
    facilities: [number, number, number];
  };
  play: { leagues_open: number; cups_open: number; matches_24h: number; changes_24h: number; lineups_24h: number; friendlies_24h: number; friendlies_played_24h: number };
  health: {
    leagues_overdue: { id: number; division: number; ends_at: string }[];
    cups_overdue: { id: number; kind: number; ends_at: string }[];
    unscored_rounds: number;
    db_size: number;
  };
};
export const loadOverview = () => call<Overview>("admin_overview");

export type OnlineRow = { id: string; email: string; last_seen: string; screen: string | null; name: string | null; tag: string | null; crest: string | null; division: number | null; coins: number | null };
export const loadOnline = () => call<OnlineRow[]>("admin_online");

export type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string | null;
  banned: boolean;
  name: string | null;
  tag: string | null;
  crest: string | null;
  division: number | null;
  coins: number | null;
  has_squad: boolean | null;
  league_id: number | null;
  last_seen: string | null;
  days: number;
};
export type UserSort = "recent" | "seen" | "coins" | "division";
export const loadUsers = (q: string, sort: UserSort, offset = 0, limit = 50) =>
  call<{ total: number; rows: UserRow[] }>("admin_users", { p_q: q || null, p_sort: sort, p_limit: limit, p_offset: offset });

export type UserDetail = {
  auth: { id: string; email: string; created_at: string; last_sign_in_at: string | null; confirmed: boolean; provider: string | null };
  admin: boolean;
  presence: { last_seen: string; screen: string | null } | null;
  days: number;
  club: {
    name: string;
    tag: string;
    crest: string;
    kit: string;
    created_at: string;
    division: number;
    coins: number;
    facilities: number[];
    has_squad: boolean;
    league_id: number | null;
    league_slot: number | null;
    xp_total: number;
  } | null;
  seasons: { league_id: number; division: number; pos: number; pts: number; move: number; coins: number; wins: number; draws: number; games: number }[];
  cups: { cup_id: number; kind: number; reach: number | null; coins: number | null; starts_at: string }[];
  auction: { won: number; spent: number; leading: number };
  matches: { total: number; wins: number; last: string | null };
  events_coins: number;
  home_coins: number;
  log: { at: string; action: string; detail: Record<string, unknown> }[];
};
export const loadUser = (id: string) => call<UserDetail | null>("admin_user", { p_id: id });

export type Competitions = {
  leagues: { id: number; division: number; size: number; rounds: number; starts_at: string; ends_at: string; closed_at: string | null; humans: number; played: number; next: string | null }[];
  cups: { id: number; kind: number; size: number; starts_at: string; ends_at: string; closed_at: string | null; entries: number; champion: { name: string; tag: string } | null }[];
  auction: { round: number; idx: number; ends_at: string; bids: number; amount: number | null; name: string | null; tag: string | null }[];
};
export const loadCompetitions = () => call<Competitions>("admin_competitions");

export type LogRow = { id: number; at: string; action: string; detail: Record<string, unknown> | null; admin: string | null; target: string | null; target_name: string | null; target_email: string | null };
export const loadLog = () => call<LogRow[]>("admin_log_list", { p_limit: 200 });

export const grantCoins = (club: string, amount: number, reason: string) => call<number>("admin_grant_coins", { p_club: club, p_amount: amount, p_reason: reason });
export const renameClub = (club: string, name: string, tag: string, reason: string) => call<void>("admin_rename_club", { p_club: club, p_name: name, p_tag: tag, p_reason: reason });
export const setBan = (user: string, ban: boolean, reason: string) => call<void>("admin_ban", { p_user: user, p_ban: ban, p_reason: reason });

/** Fecha uma liga/copa atrasada pela mesma Edge Function do jogo (idempotente) e anota no registro. */
export async function forceClose(kind: "liga" | "copa", id: number) {
  const fn = kind === "liga" ? "close-league" : "close-cup";
  const { error } = await supabase().functions.invoke(fn, { body: kind === "liga" ? { league_id: id } : { cup_id: id } });
  await call("admin_note", { p_action: `fechar ${kind}`, p_detail: { id, ok: !error } }).catch(() => {});
  if (error) throw error;
}
