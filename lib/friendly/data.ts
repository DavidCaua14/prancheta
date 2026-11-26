"use client";

/** Leitura e escrita dos amistosos no Supabase. O cálculo está em ./core. */
import { serverNow } from "@/lib/time";
import { LOT_COLS, type LogRow, type LotRow } from "@/lib/league/core";
import { sendLiveChanges } from "@/lib/live-changes";
import { supabase } from "@/lib/supabase/client";
import { buildFriendlyData, FRIENDLY_COLS, type FriendlyClub, type FriendlyData, type FriendlyRow } from "./core";

export * from "./core";

export type FriendlyInvite = {
  id: number;
  kickoff: string;
  host: string;
  host_name: string;
  host_tag: string;
  host_crest: string;
  guest: string | null;
  guest_name: string | null;
  guest_tag: string | null;
};

/** Mensagem amigável para os erros das RPCs. */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  switch (code) {
    case "P0011":
      return "Você já tem 5 amistosos marcados. Jogue (ou cancele) um antes de marcar outro.";
    case "P0012":
      return "Esse convite é seu! Mande o link para um amigo aceitar.";
    case "P0013":
      return "Outro técnico já aceitou esse convite.";
    case "P0014":
      return "O convite expirou: o horário do jogo já chegou.";
    case "P0002":
      return "Convite não encontrado. Confira o código.";
    case "22023":
      return "Escolha um horário entre 2 minutos e 7 dias a partir de agora.";
    case "P0001":
      return "Monte o elenco antes de jogar.";
    default:
      return "Não deu certo agora. Tente de novo em instantes.";
  }
}

export async function createFriendly(kickoff: number): Promise<string> {
  const { data, error } = await supabase().rpc("create_friendly", { p_kickoff: new Date(kickoff).toISOString() });
  if (error) throw error;
  return data as string;
}

export async function getInvite(code: string): Promise<FriendlyInvite | null> {
  const { data, error } = await supabase().rpc("friendly_invite", { p_code: code });
  if (error) throw error;
  return ((data ?? []) as FriendlyInvite[])[0] ?? null;
}

export async function acceptFriendly(code: string): Promise<number> {
  const { data, error } = await supabase().rpc("accept_friendly", { p_code: code });
  if (error) throw error;
  return data as number;
}

export async function leaveFriendly(id: number) {
  const { error } = await supabase().rpc("leave_friendly", { p_id: id });
  if (error) throw error;
}

export type ClubTag = { name: string; tag: string; crest: string };
export type FriendlyListRow = FriendlyRow & { h: ClubTag | null; g: ClubTag | null };

/** Meus amistosos (os mais recentes primeiro), com nome e escudo dos dois clubes. */
export async function myFriendlies(clubId: string): Promise<FriendlyListRow[]> {
  const { data, error } = await supabase()
    .from("friendlies")
    .select(`${FRIENDLY_COLS},h:clubs!friendlies_host_fkey(name,tag,crest),g:clubs!friendlies_guest_fkey(name,tag,crest)`)
    .or(`host.eq.${clubId},guest.eq.${clubId}`)
    .order("kickoff", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as FriendlyListRow[];
}

/**
 * Carrega tudo o que os jogos precisam, em lote (4 leituras para N jogos):
 * clubes, escalações salvas, cartas do leilão e mudanças ao vivo.
 */
export async function loadFriendlies(rows: FriendlyRow[]): Promise<FriendlyData[]> {
  const list = rows.filter((f) => f.guest);
  if (!list.length) return [];
  const sb = supabase();
  const ids = [...new Set(list.flatMap((f) => [f.host, f.guest!]))];
  const kicks = list.map((f) => new Date(f.kickoff).getTime());
  const first = new Date(Math.min(...kicks)).toISOString();
  const last = new Date(Math.max(...kicks)).toISOString();
  const [clubs, logs, lots, changes] = await Promise.all([
    sb.from("clubs").select("id,name,tag,crest,kit,squad").in("id", ids),
    // por clube: a escalação valendo no 1º apito (por mais antiga que seja) + as seguintes
    sb.rpc("lineup_log_window", { p_clubs: ids, p_from: first, p_to: last }),
    sb.from("auction_lots").select(LOT_COLS).in("best_club", ids).lt("ends_at", last),
    sb.from("friendly_changes").select("friendly_id,club_id,tick,change").in("friendly_id", list.map((f) => f.id)),
  ]);
  for (const r of [clubs, logs, lots, changes]) if (r.error) throw r.error;
  const allChanges = (changes.data ?? []) as { friendly_id: number; club_id: string; tick: number; change: string }[];
  return list.map((f) =>
    buildFriendlyData({
      f,
      clubs: (clubs.data ?? []) as FriendlyClub[],
      logs: ((logs.data ?? []) as LogRow[]).filter((l) => l.club_id === f.host || l.club_id === f.guest),
      lots: ((lots.data ?? []) as LotRow[]).filter((l) => l.best_club === f.host || l.best_club === f.guest),
      changes: allChanges.filter((c) => c.friendly_id === f.id),
    }),
  );
}

export async function loadFriendly(id: number): Promise<FriendlyData | null> {
  const { data, error } = await supabase().from("friendlies").select(FRIENDLY_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as FriendlyRow;
  if (!row.guest) return buildFriendlyData({ f: row, clubs: [], logs: [], lots: [], changes: [] });
  return (await loadFriendlies([row]))[0];
}

/** Relê só as mudanças ao vivo. */
export async function refreshFriendlyChanges(data: FriendlyData): Promise<FriendlyData> {
  const { data: rows, error } = await supabase().from("friendly_changes").select("club_id,tick,change").eq("friendly_id", data.f.id);
  if (error) return data;
  return { ...data, changes: ((rows ?? []) as { club_id: string; tick: number; change: string }[]).map((c) => ({ round: 1, ...c })), loadedAt: serverNow() };
}

export function sendFriendlyChange(data: FriendlyData, changes: string[]) {
  return sendLiveChanges("amistoso", data.f.id, 1, changes);
}
