/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Tática ao vivo: mude postura, linha, jogo e ritmo de uma vez e toque em Salvar",
  "A tática salva já aparece na tela, com o minuto em que passa a valer",
  "Narração mais clara: cada lance mostra o escudo e a sigla do time que fez a jogada",
  "Novo: amistosos entre amigos — marque o horário, mande o link no grupo e jogue ao vivo",
  "Correção: clube que não mexe na escalação há dias agora joga com a escalação salva (não a automática)",
  "Nova: Copa das Lendas — todo sábado, 32 clubes, só para a Liga das Lendas",
  "Partidas abrem no placar e na narração; toque na câmera para ver os lances em campo",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
