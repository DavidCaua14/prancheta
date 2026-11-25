// Empacota as Edge Functions que importam o código do jogo (lib/*) num único arquivo.
// Saída: supabase/functions/<nome>/dist/index.js (fora do git).
import { build } from "esbuild";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
for (const fn of ["close-league", "close-cup"]) {
  await build({
    entryPoints: [path.join(root, "supabase/functions", fn, "index.ts")],
    outfile: path.join(root, "supabase/functions", fn, "dist/index.js"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    logLevel: "info",
  });
}
