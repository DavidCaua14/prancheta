/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Escalação e tática: 6 formações, postura, marcação e passes",
  "Capitão e cobrador de pênaltis",
  "Escalação automática e aviso de jogador fora de posição",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
