/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Leilão com 4 cartas Base boas por rodada, a partir de 100 moedas",
  "Eventos semanais: junte moedas jogando para buscar as cartas raras",
  "Prêmios de liga e copa reequilibrados; nova loja de moedas (em breve)",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
