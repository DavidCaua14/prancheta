/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Nova arte: troféus, escudos, ícones e estádio",
  "Menu do celular corrigido",
  "Tela inicial mais leve e organizada",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
