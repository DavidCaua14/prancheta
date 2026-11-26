"use client";

/** Leitura e escrita das copas no Supabase. O cálculo está em ./core. */
import { LOT_COLS, type ChangeRow, type LogRow, type LotRow } from "@/lib/league/core";
import { sendLiveChanges } from "@/lib/live-changes";
import { supabase } from "@/lib/supabase/client";
import { buildCupData, CUP_COLS, ENTRY_COLS, withCupRoundChanges, type CupConfig, type CupData, type CupEntry, type CupRow } from "./core";

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

type CupRaw = { cup: CupRow; entries: CupEntry[]; changes: ChangeRow[]; logs: LogRow[]; lots: LotRow[] };
export type Title = { closed_at: string; division: number };
export type CupHome = { entry: MyEntry | null; data: CupData | null | undefined; title: Title | null | undefined };

/**
 * Abertura da tela: minha última inscrição + a copa dela (num pedido só,
 * cup_bundle) + o último título de divisão. `skip`: copa que o aparelho já tem
 * fresca na memória (não vem de novo). Sem a função no banco, cai no caminho
 * antigo (data = undefined: quem chama lê a copa à parte; title = undefined).
 */
export async function loadCupHome(kind: number, clubId: string, skip?: number): Promise<CupHome> {
  const { data, error } = await supabase().rpc("cup_bundle", { p_kind: kind, p_skip: skip ?? null });
  if (!error && data && "entry" in data) {
    const b = data as { entry: MyEntry | null; data: CupRaw | null; title: Title | null };
    return { entry: b.entry, data: b.data ? buildCupData(b.data) : null, title: b.title };
  }
  return { entry: await myLastEntry(clubId, kind), data: undefined, title: undefined };
}

/** A copa inteira (vagas, mudanças ao vivo, escalações e cartas) num pedido só. */
export async function loadCup(cupId: number): Promise<CupData> {
  const { data, error } = await supabase().rpc("cup_data", { p_cup: cupId });
  if (!error && data?.cup) return buildCupData(data as CupRaw);
  return loadCupParts(cupId);
}

async function loadCupParts(cupId: number): Promise<CupData> {
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
  const [logs, lots] = ids.length
    ? await Promise.all([
        sb.rpc("lineup_log_window", { p_clubs: ids, p_from: row.starts_at }),
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
  return withCupRoundChanges(data, round, (rows ?? []) as ChangeRow[]);
}

export function sendCupChange(data: CupData, round: number, changes: string[]) {
  return sendLiveChanges("copa", data.cup.id, round, changes);
}

/** Último título de divisão (1º lugar) do clube: quando a temporada fechou, ou null. */
export async function lastTitle(clubId: string): Promise<Title | null> {
  const { data, error } = await supabase()
    .from("club_seasons")
    .select("division,leagues!inner(closed_at)")
    .eq("club_id", clubId)
    .eq("pos", 1)
    .order("league_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as { division: number; leagues: { closed_at: string | null } };
  return row.leagues.closed_at ? { closed_at: row.leagues.closed_at, division: row.division } : null;
}

/** Pede ao servidor para fechar a copa e pagar os prêmios (idempotente). */
export async function closeCup(cupId: number) {
  const { error } = await supabase().functions.invoke("close-cup", { body: { cup_id: cupId } });
  return !error;
}

/** Início da próxima edição em que uma inscrição feita agora entraria (hoje ou amanhã). */
export function nextEditionStart(now: number, cfg: CupConfig): number {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const day = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  let ahead = minutes < cfg.deadlineMinute ? 0 : 1;
  if (cfg.weekday !== undefined) {
    // copa semanal: próximo dia da semana certo (hoje, se ainda dá tempo)
    const dow = new Date(day).getUTCDay();
    ahead = (cfg.weekday - dow + 7) % 7;
    if (ahead === 0 && minutes >= cfg.deadlineMinute) ahead = 7;
  }
  // Brasília = UTC-3 (sem horário de verão desde 2019)
  return day + ahead * 86400_000 + (cfg.firstMinute + 3 * 60) * 60_000;
}
