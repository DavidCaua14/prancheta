/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Série A liberada: os 4 primeiros da Série B sobem",
  "A elite: CPU mais forte do jogo e 3 rebaixados",
  "Campeão da Série A ganha tela de título",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
