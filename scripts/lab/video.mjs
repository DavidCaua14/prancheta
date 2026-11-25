// Laboratório: grava um vídeo real da página /lab e monta folhas de contato.
//
//   npm run lab:video -- "modo=online&jogo=1&de=27&debug=1" 18 [mobile|desktop] [nome]
//
// Precisa do jogo rodando em http://localhost:3000 (npm run dev ou npm start)
// ou LAB_URL=http://localhost:3100. Saída em .lab/ (fora do git):
//   <nome>.webm      vídeo
//   <nome>.mp4       vídeo para compartilhar
//   <nome>/f0001.png quadros (2 por segundo)
//   <nome>_N.png     folhas de contato (12 quadros cada, com o tempo)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// playwright pode estar instalado no projeto ou globalmente (require acha os dois)
const { chromium } = createRequire(import.meta.url)("playwright");

const [query = "modo=online&jogo=1&debug=1", secs = "15", kind = "mobile", name = `lab-${Date.now()}`] = process.argv.slice(2);
const base = process.env.LAB_URL ?? "http://localhost:3000";
const out = path.resolve(".lab");
fs.mkdirSync(out, { recursive: true });

const vp = kind === "mobile" ? { width: 390, height: 760 } : { width: 1280, height: 860 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, recordVideo: { dir: path.join(out, "raw"), size: vp } });
const page = await ctx.newPage();
await page.goto(`${base}/lab?${query}`);
await page.waitForSelector("[data-lab-ready]");
await page.waitForTimeout(Number(secs) * 1000);
const video = page.video();
await ctx.close();
await browser.close();
const webm = path.join(out, `${name}.webm`);
fs.renameSync(await video.path(), webm);
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(out, `${name}.mp4`)]);

// quadros (2 por segundo) e folhas de contato com o tempo de cada quadro
const dir = path.join(out, name);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
const crop = kind === "mobile" ? ",crop=390:430:0:0" : "";
execFileSync("ffmpeg", ["-loglevel", "error", "-i", webm, "-vf", `fps=2${crop}`, path.join(dir, "f%04d.png")]);
const frames = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
for (let n = 0; n * 12 < frames.length; n++) {
  const chunk = frames.slice(n * 12, n * 12 + 12);
  const inputs = chunk.flatMap((f) => ["-i", path.join(dir, f)]);
  const labels = chunk.map((f, i) => `[${i}:v]drawtext=text='${((Number(f.slice(1, 5)) - 1) / 2).toFixed(1)}s':x=6:y=6:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.6[v${i}]`);
  const cols = 4;
  const layout = chunk.map((_, i) => `${(i % cols) === 0 ? "0" : Array.from({ length: i % cols }, () => "w0").join("+")}_${Math.floor(i / cols) === 0 ? "0" : Array.from({ length: Math.floor(i / cols) }, () => "h0").join("+")}`).join("|");
  const filter = `${labels.join(";")};${chunk.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${chunk.length}:layout=${layout}:fill=black`;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...inputs, "-filter_complex", filter, path.join(out, `${name}_${n + 1}.png`)]);
}
console.log(`vídeo: ${webm}\nquadros: ${dir} (${frames.length})\nfolhas: ${path.join(out, `${name}_*.png`)}`);
