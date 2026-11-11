#!/usr/bin/env node
// Monta os 3 pacotes e VERIFICA vazamento antes de entregar:
//   A) PRIVADO_COMPLETO  — tudo (seeds, fotos, fontes, ZIP original V2.1 preservado, docs, testes)
//   B) DEPLOY_FRONTEND_PUBLICO — allowlist estrita, SEM dados pessoais (stub de seed), com CSP e _headers
//   C) BACKEND_OPCIONAL  — server/, netlify/, sem .env
//   node scripts/build-packages.mjs <pasta-de-saida> [--stage-only]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
const STAGE_ONLY = process.argv.includes('--stage-only');
const V = 'NOSSO_SIM_V3_1';
const FRONTEND_ONLY = process.argv.includes('--frontend-only'); // só a pasta pública (Cloudflare Pages / Capacitor): sem ZIPs, sem backend, sem pacote privado
const rm = p => fs.rmSync(p, { recursive: true, force: true });
const mk = p => fs.mkdirSync(p, { recursive: true });
const cp = (from, to) => { mk(path.dirname(to)); fs.cpSync(from, to, { recursive: true }); };

const STUB_SEED = `/* DEPLOY PÚBLICO: sem dados pessoais de convidados/padrinhos.
   Para ver o planejamento neste aparelho, importe o backup JSON (Início → "Importar backup JSON"). */
window.NS_SEED = null;
`;

// ---------- B) frontend público ----------
function buildPublic(dir) {
  rm(dir); mk(dir);
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) cp(path.join(ROOT, f), path.join(dir, f));
  cp(path.join(ROOT, 'icons'), path.join(dir, 'icons'));
  cp(path.join(ROOT, 'iris'), path.join(dir, 'iris'));
  cp(path.join(ROOT, 'v31'), path.join(dir, 'v31'));
  mk(path.join(dir, 'seed')); fs.writeFileSync(path.join(dir, 'seed/seed-casal.js'), STUB_SEED);
  // CSP: o script inline do app é liberado por HASH (sem 'unsafe-inline' em scripts)
  let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (inline.length !== 1) throw new Error(`esperado 1 script inline, achei ${inline.length}`);
  const hash = crypto.createHash('sha256').update(inline[0]).digest('base64');
  const csp = `default-src 'self'; script-src 'self' 'sha256-${hash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`;
  html = html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">\n  <meta name="referrer" content="no-referrer">`);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, '_headers'), `/*\n  Content-Security-Policy: ${csp}; frame-ancestors 'none'\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: microphone=(self), camera=(), geolocation=()\n  Cache-Control: no-cache\n`);
  fs.writeFileSync(path.join(dir, 'LEIA-ME.txt'), `NOSSO SIM + ÍRIS — pacote de DEPLOY PÚBLICO\n\nEste pacote NÃO contém dados pessoais (convidados, padrinhos, fotos). Ele abre vazio.\nPara ver seu planejamento num aparelho: exporte o backup JSON no aparelho de origem e use "Importar backup JSON" no Início.\nPublique em HTTPS (ex.: Netlify Drop). A voz precisa de HTTPS ou localhost e do Chrome.\nVeja docs/COMO_RODAR_A_IRIS.md no pacote completo.\n`);
}

// ---------- C) backend ----------
function buildBackend(dir) {
  rm(dir); mk(dir);
  cp(path.join(ROOT, 'server'), path.join(dir, 'server')); rm(path.join(dir, 'server/.env'));
  cp(path.join(ROOT, 'netlify'), path.join(dir, 'netlify')); cp(path.join(ROOT, 'netlify.toml'), path.join(dir, 'netlify.toml')); cp(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'));
  fs.writeFileSync(path.join(dir, 'LEIA-ME.txt'), `BACKEND OPCIONAL DA ÍRIS\n\nNada aqui é necessário para o modo local. Copie server/.env.example para server/.env, preencha e rode:\n  node server/server.mjs\nNunca commite o .env. Veja docs/COMO_RODAR_A_IRIS.md no pacote completo.\n`);
}

// ---------- A) privado completo ----------
function buildPrivate(dir) {
  rm(dir); mk(dir);
  const skip = n => ['.git', 'node_modules', 'dist'].includes(n);
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) { if (skip(e.name) || e.name.endsWith('.zip')) continue; cp(path.join(ROOT, e.name), path.join(dir, e.name)); }
  fs.writeFileSync(path.join(dir, 'LEIA-ME-PRIVADO.txt'), `PACOTE PRIVADO — NÃO PUBLICAR\n\nContém dados pessoais de convidados, fotos (inclusive de criança), PDFs e o ZIP original V2.1 (private/pacote_original/).\nPara hospedar, use SOMENTE o ZIP "DEPLOY_FRONTEND_PUBLICO".\nRodar localmente com tudo: node server/server.mjs  → http://localhost:8080\n`);
}

const zip = (srcDir, zipPath) => { rm(zipPath); execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: srcDir }); return fs.statSync(zipPath).size; };
if (FRONTEND_ONLY) {
  const out = path.join(OUT, 'frontend'); buildPublic(out);
  try { execFileSync('node', [path.join(ROOT, 'scripts/leak-scan.mjs'), out], { stdio: 'pipe' }); console.log('✔ leak-scan frontend: limpo'); } catch (e) { console.error(`✘ leak-scan FALHOU:\n${e.stdout}${e.stderr}`); process.exit(1); }
  console.log('frontend público em', out); process.exit(0);
}
mk(OUT);
const stage = path.join(OUT, '_stage'); rm(stage); mk(stage);
buildPublic(path.join(stage, 'frontend')); buildBackend(path.join(stage, 'backend')); buildPrivate(path.join(stage, 'privado'));
if (STAGE_ONLY) { console.log('stage em', stage); process.exit(0); }
const zips = { privado: path.join(OUT, `${V}_PRIVADO_COMPLETO.zip`), frontend: path.join(OUT, `${V}_DEPLOY_FRONTEND_PUBLICO.zip`), backend: path.join(OUT, `${V}_BACKEND_OPCIONAL.zip`) };
for (const [k, d] of [['privado', 'privado'], ['frontend', 'frontend'], ['backend', 'backend']]) console.log(`${k.padEnd(9)} ${(zip(path.join(stage, d), zips[k]) / 1024).toFixed(0)} KB  ${path.basename(zips[k])}`);

// ---------- verificação obrigatória ----------
let bad = false;
for (const k of ['frontend', 'backend']) { try { execFileSync('node', [path.join(ROOT, 'scripts/leak-scan.mjs'), zips[k]], { stdio: 'pipe' }); console.log(`✔ leak-scan ${k}: limpo`); } catch (e) { bad = true; console.error(`✘ leak-scan ${k} FALHOU:\n${e.stdout}${e.stderr}`); } }
const list = k => execFileSync('unzip', ['-Z1', zips[k]], { encoding: 'utf8' }).split('\n');
if (!list('privado').some(f => f.startsWith('seed/seed-casal.js')) || !list('privado').some(f => f.includes('pacote_original/CASAMENTO_GABRIEL_ISABELLE_V2_1_CLAUDE.zip'))) { bad = true; console.error('✘ pacote privado sem seed/ZIP original (sanidade)'); }
if (list('frontend').some(f => /^(private|assets\/(casal|padrinhos))\//.test(f))) { bad = true; console.error('✘ frontend contém caminhos privados'); }
fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), Object.values(zips).map(z => `${crypto.createHash('sha256').update(fs.readFileSync(z)).digest('hex')}  ${path.basename(z)}`).join('\n') + '\n');
if (bad) { console.error('\nBUILD REPROVADO'); process.exit(1); }
console.log('✔ build aprovado');
