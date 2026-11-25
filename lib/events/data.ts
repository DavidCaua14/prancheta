"use client";

/**
 * Eventos semanais: missões que pagam moedas por jogar.
 * O banco decide (current_event, my_event_progress, claim_mission); o aparelho
 * só mostra — e calcula o que ainda está "a confirmar" (temporada/copa em
 * andamento), que entra quando ela fechar.
 */
import { supabase } from "@/lib/supabase/client";

export type Mission = { metric: Metric; target: number; reward: number; label: string };
export type Metric = "games" | "wins" | "goals" | "clean_sheets" | "big_wins" | "cup_games" | "cup_wins" | "cups" | "seasons" | "top4" | "titles" | "promotions";
export type WeekEvent = { week_start: string; ends_at: string; template: number; slug: string; name: string; description: string; missions: Mission[] };
export type Progress = Record<Metric, number>;
export type Template = { id: number; slug: string; name: string };

export const METRIC_LABEL: Record<Metric, string> = {
  games: "partidas",
  wins: "vitórias",
  goals: "gols",
  clean_sheets: "jogos sem sofrer gol",
  big_wins: "goleadas",
  cup_games: "jogos de copa",
  cup_wins: "fases avançadas",
  cups: "copas",
  seasons: "temporadas",
  top4: "temporadas no G4",
  titles: "títulos",
  promotions: "acessos",
};

export async function currentEvent(): Promise<WeekEvent | null> {
  const { data, error } = await supabase().rpc("current_event");
  if (error) throw error;
  return ((data ?? []) as WeekEvent[])[0] ?? null;
}

export async function myProgress(): Promise<{ progress: Progress; claimed: number[] }> {
  const { data, error } = await supabase().rpc("my_event_progress");
  if (error) throw error;
  return data as { progress: Progress; claimed: number[] };
}

export async function templates(): Promise<Template[]> {
  const { data } = await supabase().from("event_templates").select("id,slug,name").order("id");
  return (data ?? []) as Template[];
}

export async function claimMission(index: number): Promise<{ coins: number } | { error: "incomplete" | "claimed" | "network" }> {
  const { data, error } = await supabase().rpc("claim_mission", { p_mission: index });
  if (!error) return { coins: data as number };
  return { error: error.code === "P0011" ? "incomplete" : error.code === "P0012" ? "claimed" : "network" };
}
