/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Série C liberada: os 4 primeiros da Série D sobem",
  "Série C com CPU mais experiente e 3 rebaixados",
  "Tabela da Série D com zona de acesso e de rebaixamento",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
