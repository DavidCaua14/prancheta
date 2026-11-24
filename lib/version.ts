/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Login com Google",
  "Funde seu clube: nome, escudo e camisa do seu jeito",
  "Sede do clube",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
