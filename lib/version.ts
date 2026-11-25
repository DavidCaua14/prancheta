/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Quadro animado da partida: veja as jogadas acontecendo junto com a narração",
  "Narração e placar no instante exato de cada lance; times trocam de lado no 2º tempo",
  "Novas táticas: linha defensiva, jogo pelo meio ou pelas pontas e ritmo",
  "A tela de tática indica o que combina com os seus titulares",
  "Treino mais longo para acompanhar as jogadas (com 2x e 4x)",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
