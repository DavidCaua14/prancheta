/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Peneira: monte seu elenco inicial escolhendo cartas Base",
  "Nova tela inicial do clube (protótipo)",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
