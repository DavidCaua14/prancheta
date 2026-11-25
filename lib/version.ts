/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Copa Nacional: 64 clubes da Série C para cima, todo dia das 11h30 às 21h30",
  "Campeão da Copa Nacional leva 1.600 moedas",
  "Times da CPU das copas sem nomes repetidos na chave",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
