/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Partidas abrem no placar e na narração; toque na câmera para ver os lances em campo",
  "A escolha da câmera fica salva no aparelho",
  "Quadro da partida mais realista: jogadas construídas, sem toques de vai-e-volta",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
