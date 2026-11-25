/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Série B liberada: os 4 primeiros da Série C sobem",
  "Série B com a CPU mais forte até agora e 3 rebaixados",
  "Série C agora tem zona de acesso",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
