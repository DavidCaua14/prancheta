/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Nova: Copa das Lendas — todo sábado, 32 clubes, só para a Liga das Lendas (campeão leva 1.000 moedas)",
  "Partidas abrem no placar e na narração; toque na câmera para ver os lances em campo",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
