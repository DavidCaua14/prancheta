/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "14 formações, incluindo Quadrado mágico, Losango e Árvore de Natal",
  "Aviso claro de jogador fora de posição na escalação",
  "Ao selecionar um jogador, o campinho mostra onde ele rende melhor",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
