/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Acesso à Série D: os 4 primeiros da Várzea sobem",
  "Série D com times da CPU mais fortes e 3 rebaixados",
  "Tela de fim de temporada com sua campanha",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
