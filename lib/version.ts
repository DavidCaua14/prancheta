/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Copas abrem 2× mais rápido, com a chave e os placares de uma vez",
  "Leilão abre mais rápido, com lotes e lances juntos, e gasta menos bateria",
  "Tela da liga abre quase 2× mais rápido e não engasga durante os jogos ao vivo",
  "Tela de eventos até 3× mais rápida",
  "Correções para muitos jogadores ao mesmo tempo: vagas na liga e inscrições nas copas",
  "Ranking pontua mais rápido quando vários técnicos abrem o jogo juntos",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
