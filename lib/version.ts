/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Leilão aberto: 8 cartas Destaque, Épica e Especial a cada 2 horas",
  "Você começa com 1.000 moedas e ganha mais no fim de cada temporada",
  "Cartas arrematadas entram no elenco e também evoluem",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
