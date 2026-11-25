"use client";

/** Leitura e escrita das copas no Supabase. O cálculo está em ./core. */
import { LOT_COLS, type ChangeRow, type LogRow, type LotRow } from "@/lib/league/core";
import { supabase } from "@/lib/supabase/client";
import { buildCupData, CUP_COLS, ENTRY_COLS, type CupData, type CupEntry, type CupRow } from "./core";

export * from "./core";

export type MyEntry = { cup_id: number; slot: number; reach: number | null; coins: number | null; cups: CupRow };

/** Última inscrição do clube numa copa (ativa ou a mais recente encerrada). */
export async function myLastEntry(clubId: string, kind = 0): Promise<MyEntry | null> {
  const { data, error } = await supabase()
    .from("cup_entries")
    .select(`cup_id,slot,reach,coins,cups!inner(${CUP_COLS})`)
    .eq("club_id", clubId)
    .eq("cups.kind", kind)
    .order("cup_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as MyEntry | null;
}

export async function joinCup(kind = 0): Promise<number> {
  const { data, error } = await supabase().rpc("join_cup", { p_kind: kind });
  if (error) throw error;
  return data as number;
}

export async function loadCup(cupId: number): Promise<CupData> {
  const sb = supabase();
  const [cup, entries, changes] = await Promise.all([
    sb.from("cups").select(CUP_COLS).eq("id", cupId).single(),
    sb.from("cup_entries").select(ENTRY_COLS).eq("cup_id", cupId),
    sb.from("cup_changes").select("round,club_id,tick,change").eq("cup_id", cupId),
  ]);
  if (cup.error) throw cup.error;
  if (entries.error) throw entries.error;
  if (changes.error) throw changes.error;
  const row = cup.data as CupRow;
  const list = (entries.data ?? []) as unknown as CupEntry[];
  const ids = list.map((e) => e.club_id);
  const since = new Date(new Date(row.starts_at).getTime() - 11 * 86400_000).toISOString();
  const [logs, lots] = ids.length
    ? await Promise.all([
        sb.from("lineup_log").select("club_id,at,lineup").in("club_id", ids).gte("at", since).order("at"),
        sb.from("auction_lots").select(LOT_COLS).in("best_club", ids).lt("ends_at", new Date().toISOString()),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (logs.error) throw logs.error;
  if (lots.error) throw lots.error;
  return buildCupData({ cup: row, entries: list, logs: (logs.data ?? []) as LogRow[], changes: (changes.data ?? []) as ChangeRow[], lots: (lots.data ?? []) as LotRow[] });
}

/** Relê só as mudanças ao vivo de uma fase. */
export async function refreshCupChanges(data: CupData, round: number): Promise<CupData> {
  const { data: rows, error } = await supabase().from("cup_changes").select("round,club_id,tick,change").eq("cup_id", data.cup.id).eq("round", round);
  if (error) return data;
  return { ...data, changes: [...data.changes.filter((c) => c.round !== round), ...((rows ?? []) as ChangeRow[])] };
}

export async function sendCupChange(data: CupData, round: number, clubId: string, tick: number, change: string) {
  const { error } = await supabase().from("cup_changes").insert({ cup_id: data.cup.id, round, club_id: clubId, tick, change });
  return !error;
}

/** Pede ao servidor para fechar a copa e pagar os prêmios (idempotente). */
export async function closeCup(cupId: number) {
  const { error } = await supabase().functions.invoke("close-cup", { body: { cup_id: cupId } });
  return !error;
}

/** Início da próxima edição em que uma inscrição feita agora entraria (13h de hoje ou de amanhã). */
export function nextEditionStart(now: number): number {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const day = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  // Brasília = UTC-3 (sem horário de verão desde 2019)
  return day + (minutes < 12 * 60 + 45 ? 0 : 86400_000) + 16 * 3600_000;
}
