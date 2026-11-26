"use client";

/** Leitura e lances do leilão no Supabase (regras em ./lots). */
import { supabase } from "@/lib/supabase/client";

export type LotState = { round: number; idx: number; best_club: string | null; best_amount: number; bids: number; ends_at: string };
export type Bidder = { id: string; name: string; tag: string; crest: string };

const COLS = "round,idx,best_club,best_amount,bids,ends_at";

/**
 * Lances das rodadas pedidas (no máximo 8 linhas por rodada) + lotes de
 * rodadas anteriores que ainda estão em disputa (lance há menos de 10 min).
 */
export async function loadLots(rounds: number[]): Promise<LotState[]> {
  const open = new Date().toISOString();
  const { data, error } = await supabase()
    .from("auction_lots")
    .select(COLS)
    .or(`round.in.(${rounds.join(",")}),ends_at.gt.${open}`);
  if (error) throw error;
  return (data ?? []) as LotState[];
}

/** Lotes em que o clube tem o maior lance (liderando ou já arrematados). */
export async function loadMine(clubId: string): Promise<LotState[]> {
  const { data, error } = await supabase().from("auction_lots").select(COLS).eq("best_club", clubId).order("ends_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LotState[];
}

/** Nome e escudo de quem está liderando (só os que ainda não estão em memória). */
const bidders = new Map<string, Bidder>();
export async function loadBidders(ids: string[]): Promise<Map<string, Bidder>> {
  const missing = [...new Set(ids)].filter((id) => !bidders.has(id));
  if (missing.length) {
    const { data } = await supabase().from("clubs").select("id,name,tag,crest").in("id", missing);
    for (const b of (data ?? []) as Bidder[]) bidders.set(b.id, b);
  }
  return bidders;
}

export type AuctionBundle = { lots: LotState[]; mine: LotState[]; bidders: Map<string, Bidder>; coins: number | null };

/**
 * Tela do leilão num pedido só (auction_bundle): lotes da rodada atual e da
 * anterior + os ainda em disputa, os meus lances, quem lidera e as minhas
 * moedas. Se a função faltar, cai no caminho antigo (várias leituras).
 */
export async function loadAuction(round: number, clubId: string): Promise<AuctionBundle> {
  const { data, error } = await supabase().rpc("auction_bundle", { p_round: round });
  if (!error && data?.lots) {
    const b = data as { lots: LotState[]; bidders: Bidder[]; coins: number | null };
    for (const x of b.bidders) bidders.set(x.id, x);
    const mine = b.lots.filter((l) => l.best_club === clubId).sort((a, c) => c.ends_at.localeCompare(a.ends_at));
    const lots = b.lots.filter((l) => l.round >= round - 1 || new Date(l.ends_at).getTime() > Date.now() || l.best_club === clubId);
    return { lots, mine, bidders: new Map(bidders), coins: b.coins };
  }
  const [cur, mine] = await Promise.all([loadLots([round, round - 1]), loadMine(clubId)]);
  const names = await loadBidders(cur.map((l) => l.best_club).filter((x): x is string => !!x));
  return { lots: [...cur, ...mine], mine, bidders: new Map(names), coins: null };
}

export type BidError = "min" | "leader" | "coins" | "full" | "closed" | "network";

export async function placeBid(round: number, idx: number, amount: number): Promise<{ lot: LotState } | { error: BidError; detail?: string }> {
  const { data, error } = await supabase().rpc("place_bid", { p_round: round, p_idx: idx, p_amount: amount });
  if (!error) return { lot: data as LotState };
  const map: Record<string, BidError> = { P0006: "min", P0005: "leader", P0008: "coins", P0007: "full", P0004: "closed" };
  return { error: map[error.code ?? ""] ?? "network", detail: error.message };
}
