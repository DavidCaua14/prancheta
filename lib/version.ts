/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Copa da Várzea: mata-mata diário de 32 clubes, das 13h às 21h",
  "Pênaltis no empate, mudanças ao vivo e prêmio de até 600 moedas",
  "Cartas do leilão agora podem entrar ao vivo nas substituições",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
