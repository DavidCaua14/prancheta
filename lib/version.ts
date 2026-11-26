/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Novo: ranking entre técnicos — geral e da semana, com pódio",
  "Ranking ao vivo: cada vitória pontua logo depois do apito final",
  "Estrutura do clube com arte para cada nível, do Terrão à Arena",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
