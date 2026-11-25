/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Evolução das cartas: cada jogo da liga dá XP",
  "Cada nível vale +1 de overall (até 70 nas cartas Base)",
  "Bônus de XP no acesso e no título; veja tudo no Elenco",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
