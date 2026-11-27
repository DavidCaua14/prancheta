"use client";

/** Estrutura do clube no Supabase: melhorar, receber a renda dos jogos em casa e o histórico. */
import { supabase } from "@/lib/supabase/client";
import type { FacilityKind } from "./facilities";

export type HomeIncomeRow = { league_id: number; round: number; stadium: number; snack: number; shop: number; coins: number; paid_at: string };
export type SeasonRow = { league_id: number; division: number; pos: number; pts: number; move: number; coins: number };

export type UpgradeResult = { ok: true; levels: number[] } | { ok: false; reason: "coins" | "max" | "network" };

export async function upgradeFacility(kind: FacilityKind): Promise<UpgradeResult> {
  const { data, error } = await supabase().rpc("upgrade_facility", { p_kind: kind });
  if (error) return { ok: false, reason: error.code === "P0017" ? "max" : error.code === "P0008" ? "coins" : "network" };
  if (!data) return { ok: false, reason: "coins" };
  return { ok: true, levels: data as number[] };
}

/** Recebe a renda dos jogos em casa já encerrados (o servidor confere e paga uma vez só). */
export async function collectHomeIncome(): Promise<number> {
  const { data, error } = await supabase().rpc("collect_home_income");
  return error ? 0 : ((data as number) ?? 0);
}

export async function recentHomeIncome(clubId: string, limit = 8): Promise<HomeIncomeRow[]> {
  const { data } = await supabase()
    .from("home_income")
    .select("league_id,round,stadium,snack,shop,coins,paid_at")
    .eq("club_id", clubId)
    .gt("coins", 0) // jogos sem estrutura (0 moedas) não entram na lista
    .order("paid_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as HomeIncomeRow[];
}

/** Renda de um jogo em casa específico (para o fim da partida). */
export async function homeIncomeOf(clubId: string, leagueId: number, round: number): Promise<HomeIncomeRow | null> {
  const { data } = await supabase()
    .from("home_income")
    .select("league_id,round,stadium,snack,shop,coins,paid_at")
    .eq("club_id", clubId)
    .eq("league_id", leagueId)
    .eq("round", round)
    .maybeSingle();
  return (data as HomeIncomeRow | null) ?? null;
}

export async function seasonHistory(clubId: string): Promise<SeasonRow[]> {
  const { data } = await supabase()
    .from("club_seasons")
    .select("league_id,division,pos,pts,move,coins")
    .eq("club_id", clubId)
    .order("league_id", { ascending: false })
    .limit(30);
  return (data ?? []) as SeasonRow[];
}

const GIFT_SEEN = (clubId: string) => `prancheta:presente:${clubId}`;

/**
 * Presentes do clube (hoje: 5.000 moedas de boas-vindas, uma vez). O banco
 * confere e credita; o aparelho lembra que já perguntou para não chamar de novo.
 */
export async function claimGifts(clubId: string): Promise<number> {
  try {
    if (localStorage.getItem(GIFT_SEEN(clubId)) === "1") return 0;
  } catch {}
  const { data, error } = await supabase().rpc("claim_gifts");
  if (error) return 0;
  try {
    localStorage.setItem(GIFT_SEEN(clubId), "1");
  } catch {}
  return (data as number) ?? 0;
}
