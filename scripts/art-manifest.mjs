// Gera lib/art-manifest.ts com as artes existentes em public/art.
// Roda sozinho antes de `npm run dev` e `npm run build`.
import { readdirSync, writeFileSync } from "node:fs";

const files = readdirSync("public/art").filter((f) => /\.(webp|png|avif|jpg)$/.test(f)).sort();
const entries = files.map((f) => `  ${JSON.stringify(f.replace(/\.[^.]+$/, ""))}: ${JSON.stringify(`/art/${f}`)},`).join("\n");
writeFileSync(
  "lib/art-manifest.ts",
  `// Arquivo gerado por scripts/art-manifest.mjs — não edite à mão.\nexport const ART: Record<string, string> = {\n${entries}\n};\n`,
);
console.log(`art-manifest: ${files.length} artes`);
