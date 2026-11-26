/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Novo: estrutura do clube — estádio, lanchonete e loja oficial rendem moedas nos jogos em casa",
  "Aba Clube reorganizada: obras, renda dos jogos em casa e a história do clube",
  "Leilão: carta arrematada dá lugar a outra na hora, com o potencial à vista",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
