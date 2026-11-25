/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Supercopa: todo domingo, só para campeões de divisão",
  "16 campeões, das 14h30 às 20h30; o vencedor leva 2.000 moedas",
  "Ganhou sua liga? Sua vaga na Supercopa vale por 7 dias",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
