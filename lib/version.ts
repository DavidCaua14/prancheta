/** Versão embutida no bundle no momento do build (ver next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Notas da versão atual. Atualize a cada deploy: o texto aparece no aviso
 * de atualização obrigatória que os jogadores veem.
 */
export const RELEASE_NOTES: string[] = [
  "Prêmios bem maiores: campeão da Várzea leva 1.800 moedas, das Lendas 10.500",
  "Eventos semanais: missões que pagam moedas grátis por jogar",
  "Nova loja de moedas (pagamentos em breve) e +500 moedas de presente",
];

export type VersionPayload = {
  version: string;
  notes: string[];
};
