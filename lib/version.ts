/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Quadro da partida mais realista: jogadas construídas, sem toques de vai-e-volta",
  "Gols nascem de jogadas visíveis; escanteios aparecem na narração ao vivo",
  "Treino mais longo (cerca de 7 minutos no 1x), com 2x e 4x",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
