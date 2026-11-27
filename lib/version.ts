/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Novo: Prancheta Temporadas, o modo carreira com clubes reais (protótipo)",
  "Treino no celular mostra estatísticas e o seu time antes do apito; telas com erro mostram aviso em vez de ficar em branco",
  "Botão de voltar no Elenco e no Meu clube (e o voltar do celular agora volta para o Início)",
  "Presente: 5.000 moedas para todos os técnicos, para um lance forte no leilão",
  "Partida ao vivo mais leve: gasta menos bateria, com ou sem a câmera",
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
