/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Leilão: carta arrematada dá lugar a outra na hora",
  "Leilão: potencial de cada carta à vista — até onde chega de overall e de nível",
  "Arrematou? A carta aparece numa animação com o valor pago",
  "Aviso de atualização mais compacto, em qualquer tela",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
