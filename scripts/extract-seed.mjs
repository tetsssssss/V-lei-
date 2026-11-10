#!/usr/bin/env node
// Extrai os dados pessoais embutidos no index.html ORIGINAL (V2.1) para um arquivo de seed PRIVADO.
//   node scripts/extract-seed.mjs <index-original.html> <saida: seed/seed-casal.js> [extra.json]
// - Não contém dados: lê do original e grava só no destino (que deve estar no .gitignore).
// - extra.json (opcional, privado): { photoLinks:[...], settings:{...} } mesclado no seed.
import fs from 'node:fs';

const [, , src, out, extra] = process.argv;
if (!src || !out) { console.error('uso: extract-seed.mjs <index.html original> <seed.js> [extra.json]'); process.exit(2); }

const html = fs.readFileSync(src, 'utf8');
const grab = name => {
  const m = html.match(new RegExp(`const ${name} = (\\[.*?\\]);\\n`, 's'));
  if (!m) throw new Error(`não achei ${name} no original`);
  return JSON.parse(m[1]);
};
const msg = html.match(/message:'((?:[^'\\]|\\.)*)'\},budget:\[\]/);
const seed = { guests: grab('receivedGuests'), couples: grab('receivedCouples') };
if (msg) seed.settings = { message: msg[1].replace(/\\'/g, "'") };
if (extra) Object.assign(seed, JSON.parse(fs.readFileSync(extra, 'utf8')));

const body = `/* PRIVADO — gerado por scripts/extract-seed.mjs. Contém dados pessoais de terceiros.
   NÃO versionar, NÃO publicar, NÃO incluir no ZIP de deploy público. */
window.NS_SEED = ${JSON.stringify(seed, null, 1)};
`;
fs.mkdirSync(new URL('.', 'file://' + process.cwd() + '/' + out).pathname, { recursive: true });
fs.writeFileSync(out, body);
console.log(`seed gravado em ${out}: ${seed.guests.length} convites, ${seed.couples.length} pares, ${seed.photoLinks?.length || 0} vínculos de foto`);
