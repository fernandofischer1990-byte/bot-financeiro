#!/usr/bin/env node
/**
 * Orçamento de performance: soma o JS realmente baixado na rota inicial
 * (entry + módulos pré-carregados via <link rel="modulepreload">) e falha
 * se passar do limite. Chunks lazy (rotas, recharts, xlsx) não entram.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST = path.resolve("dist");
const LIMIT_KB = Number(process.env.INITIAL_CHUNK_LIMIT_KB ?? 400);

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/index.html não encontrado — rode `npm run build` antes.");
  process.exit(1);
}

const html = readFileSync(path.join(DIST, "index.html"), "utf8");
const files = new Set();
const patterns = [
  /<script[^>]+src="([^"]+\.js)"/g,
  /<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g,
];
for (const re of patterns) {
  for (const m of html.matchAll(re)) files.add(m[1].replace(/^\//, ""));
}

if (files.size === 0) {
  console.error("Nenhum JS inicial encontrado em dist/index.html.");
  process.exit(1);
}

let rawTotal = 0;
let gzipTotal = 0;
const rows = [];
for (const file of [...files].sort()) {
  const full = path.join(DIST, file);
  if (!existsSync(full)) continue;
  const buf = readFileSync(full);
  const raw = statSync(full).size;
  const gz = gzipSync(buf).length;
  rawTotal += raw;
  gzipTotal += gz;
  rows.push({ file, raw, gz });
}

const kb = (n) => (n / 1024).toFixed(1) + " kB";
console.log("Chunks da rota inicial:");
for (const r of rows) console.log(`  ${r.file}  ${kb(r.raw)} (gzip ${kb(r.gz)})`);
console.log(`Total inicial: ${kb(rawTotal)} (gzip ${kb(gzipTotal)})`);
console.log(`Limite: ${LIMIT_KB} kB (bruto)`);

if (rawTotal / 1024 > LIMIT_KB) {
  console.error(
    `\nFALHA: chunk inicial de ${kb(rawTotal)} excede o orçamento de ${LIMIT_KB} kB.`
  );
  process.exit(1);
}
console.log("\nOK: chunk inicial dentro do orçamento.");
