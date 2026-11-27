import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * Versão do jogo.
 * Cada build (deploy) gera uma versão única. O cliente guarda a versão com a
 * qual foi carregado e compara periodicamente com /api/version. Se mudar,
 * o jogador é obrigado a recarregar (ver components/system/UpdateWatcher.tsx).
 */
function resolveAppVersion(): string {
  const fromEnv =
    process.env.APP_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return `build-${Date.now()}`;
  }
}

const APP_VERSION = resolveAppVersion();

/**
 * Em desenvolvimento, o Next só libera os scripts para "localhost". Para testar
 * no celular pelo IP da rede (ex.: http://192.168.0.10:3000) liberamos as faixas
 * de rede local. Outras origens: DEV_ORIGINS="meu-tunel.dev,outro.host".
 */
const DEV_ORIGINS = [
  "192.168.*.*",
  "10.*.*.*",
  "172.*.*.*",
  "*.local",
  ...(process.env.DEV_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: DEV_ORIGINS,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Fora da Vercel, protege navegações contra "version skew" entre deploys.
  // Na Vercel não definimos: ela gera um ID próprio por deploy (e exige que
  // seja único — o mesmo commit publicado em dois branches daria conflito).
  deploymentId: process.env.VERCEL ? undefined : APP_VERSION,
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()),
  },
  // o protótipo do Temporadas que morava aqui virou um site próprio
  async redirects() {
    const to = process.env.NEXT_PUBLIC_TEMPORADAS_URL ?? "https://prancheta-temporadas.vercel.app";
    return [
      { source: "/temporadas", destination: `${to}/?ref=online&slot=redirect`, permanent: false },
      { source: "/temporadas/:path*", destination: `${to}/?ref=online&slot=redirect`, permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/version",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
