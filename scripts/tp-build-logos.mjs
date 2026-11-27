// Escudos do Prancheta Temporadas: data-src/logos/<pais>/*.svg|png → public/tp/logos/<pais>/<slug>-128.webp e -48.webp
// Uso: node scripts/tp-build-logos.mjs
import { readdirSync, mkdirSync, statSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

const SRC = "data-src/logos";
const OUT = "public/tp/logos";
const report = [];
for (const country of readdirSync(SRC)) {
  const dir = join(SRC, country);
  if (!statSync(dir).isDirectory()) continue;
  mkdirSync(join(OUT, country), { recursive: true });
  for (const file of readdirSync(dir)) {
    const { name, ext } = parse(file);
    if (![".svg", ".png", ".webp"].includes(ext.toLowerCase())) continue;
    const input = join(dir, file);
    // recorta bordas transparentes, centraliza num quadrado com folga
    const trimmed = await sharp(input, { density: 300 }).trim().png().toBuffer();
    for (const size of [128, 48]) {
      const inner = Math.round(size * 0.92);
      await sharp(trimmed)
        .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: (size - inner) >> 1, bottom: size - inner - ((size - inner) >> 1), left: (size - inner) >> 1, right: size - inner - ((size - inner) >> 1), background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 88, alphaQuality: 100 })
        .toFile(join(OUT, country, `${name}-${size}.webp`));
    }
    const meta = await sharp(input).metadata();
    if (ext !== ".svg" && (meta.width ?? 0) < 256) report.push(`${country}/${file}: pequeno (${meta.width}px)`);
  }
}
console.log(report.length ? report.join("\n") : "escudos ok");
