/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Fim de jogo mostra os pontos ganhos e a sua subida no ranking, com animação",
  "Ranking ao vivo: cada vitória pontua logo depois do apito final",
  "Página inicial atualizada com ranking, estrutura do clube, eventos e treino",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
