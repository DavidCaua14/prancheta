/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Liga das Lendas liberada: os 4 primeiros da Série A sobem",
  "O topo do Prancheta: só esquadrões lendários na CPU",
  "Série A agora tem zona de acesso",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
