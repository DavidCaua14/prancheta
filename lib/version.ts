/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Liga da Várzea: 8 rodadas por dia, das 8h às 22h",
  "Jogos ao vivo com tabela, rodadas e mudanças durante a partida",
  "Times da CPU completam a liga: sempre tem jogo",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
