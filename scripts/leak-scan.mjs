#!/usr/bin/env node
// Varredura anti-vazamento. Falha (exit 1) se achar dados privados ou segredos.
//   node scripts/leak-scan.mjs <arquivo|pasta|zip> [...]
//   node scripts/leak-scan.mjs --tracked          (todos os arquivos rastreados pelo git + staged)
// A denylist de NOMES REAIS é lida em tempo de execução de seed/seed-casal.js (nunca fica no repositório).
// Sem o seed local (ex.: máquina de outra pessoa), a varredura de nomes é pulada com aviso — as demais continuam.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const COUPLE = new Set(['gabriel', 'isabelle']); // o casal pode aparecer no código
const GENERIC = new Set(['esposa', 'esposo', 'filho', 'filha', 'marido', 'namorado', 'namorada', 'madrasta', 'gemeos', 'amigos', 'familia', 'imagem', 'relacao', 'enviada', 'padrinhos', 'entrada', 'pendente', 'adulto', 'adultos', 'criança', 'criancas', 'pessoa', 'pessoas', 'mae', 'tios', 'tia', 'tio', 'vovo']);

// ---------- denylist de nomes (do seed privado) ----------
function loadNames() {
  const seedPath = path.join(ROOT, 'seed', 'seed-casal.js');
  if (!fs.existsSync(seedPath)) return { tokens: [], phrases: [], available: false };
  const sandbox = { window: {} };
  new Function('window', fs.readFileSync(seedPath, 'utf8'))(sandbox.window);
  const seed = sandbox.window.NS_SEED || {};
  const phrases = new Set(), tokens = new Set();
  const feed = text => {
    if (!text) return;
    const cleaned = String(text).replace(/\([^)]*\)/g, ' ');
    phrases.add(strip(String(text)).trim());
    for (const t of strip(cleaned).split(/[^a-z]+/)) if (t.length >= 4 && !COUPLE.has(t) && !GENERIC.has(t)) tokens.add(t);
  };
  (seed.guests || []).forEach(g => feed(g.name));
  (seed.couples || []).forEach(c => feed(c.name));
  (seed.photoLinks || []).forEach(p => feed(p.label));
  return { tokens: [...tokens], phrases: [...phrases].filter(p => p.length >= 8), available: true };
}

// ---------- hashes de arquivos privados (imagens/PDFs) ----------
function privateHashes() {
  const hashes = new Map();
  const dirs = ['assets/casal', 'assets/padrinhos', 'private/fontes_do_casal', 'private/referencias_privadas'];
  const walk = d => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else hashes.set(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), p); } };
  dirs.forEach(d => walk(path.join(ROOT, d)));
  return hashes;
}

const FORBIDDEN_PATH = [/(^|\/)private\//, /(^|\/)fontes_do_casal\//, /(^|\/)referencias_privadas\//, /(^|\/)fotos_padrinhos\//, /(^|\/)assets\/padrinhos\//, /(^|\/)assets\/casal\//, /\.pdf$/i, /(^|\/)preview-[^/]*\.png$/i, /nosso-sim-backup-.*\.json$/i, /(^|\/)\.env(\.[^/]*)?$/, /\.(keystore|jks)$/i, /chave-senha\.txt$/i];
const FORBIDDEN_OK = [/(^|\/)\.env\.example$/];
const SECRET_RES = [
  [/sk-ant-[A-Za-z0-9_-]{16,}/, 'chave Anthropic'], [/sk-[A-Za-z0-9]{32,}/, 'chave estilo OpenAI'], [/AKIA[0-9A-Z]{16}/, 'chave AWS'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada PEM'], [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'token Slack'], [/ghp_[A-Za-z0-9]{30,}/, 'token GitHub'],
  [/[A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSCODE)[A-Za-z0-9_]*\s*[:=]\s*['"]?[A-Za-z0-9_\-./+]{16,}/i, 'atribuição de segredo com valor', 'generic'],
];
// Nomes de VOZES sintéticas públicas (Apple/Microsoft/Google) coincidem com primeiros nomes comuns: liberados só neste arquivo.
const ALLOW_TOKENS = [{ file: /(^|\/)voice\/tts\.js$/, tokens: ['maria', 'antonio', 'luciana', 'giovanna', 'daniel', 'felipe', 'ricardo', 'thiago', 'jose', 'jorge', 'marcos', 'camila', 'fernanda', 'francisca', 'vitoria', 'leticia', 'raquel', 'heloisa', 'manuela', 'joana', 'brenda', 'thalita', 'yara', 'donato', 'tiago'] }];
const TEXT_EXT = /\.(html?|js|mjs|cjs|css|json|md|txt|webmanifest|toml|env|yml|yaml|svg|csv|sh)$/i;

const names = loadNames();
const hashes = privateHashes();
const findings = [];
const add = (where, kind, detail) => findings.push({ where, kind, detail });

function scanBuffer(where, buf) {
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (hashes.has(sha)) add(where, 'ARQUIVO PRIVADO', `idêntico a ${hashes.get(sha)}`);
  if (!TEXT_EXT.test(where)) return;
  const text = buf.toString('utf8');
  // Contextos públicos conhecidos que coincidem com sobrenomes (ex.: endereço comercial de fornecedor).
  const norm = strip(text).replaceAll('rua marcondes salgado', ' ');
  if (names.available && !/(^|\/)leak-scan\.mjs$/.test(where)) { // o scanner cita nomes de voz na lista de exceção
    for (const ph of names.phrases) if (norm.includes(ph)) add(where, 'NOME REAL', `frase "${ph.slice(0, 3)}…" (${ph.length} car.)`);
    const allowed = new Set(ALLOW_TOKENS.filter(a => a.file.test(where.replaceAll('\\', '/'))).flatMap(a => a.tokens));
    for (const tk of names.tokens) if (!allowed.has(tk) && new RegExp(`(^|[^a-z])${tk}([^a-z]|$)`).test(norm)) add(where, 'NOME REAL', `token "${tk.slice(0, 2)}…" (${tk.length} letras)`);
  }
  if (/seed-casal\.js$/.test(where) && /window\.NS_SEED\s*=\s*\{[^}]*(guests|couples)/.test(text)) add(where, 'SEED REAL', 'seed de convidados/padrinhos presente');
  for (const [re, label, kind] of SECRET_RES) if (re.test(text) && !/\.env\.example$/.test(where) && !(kind === 'generic' && /(^|\/)tests\//.test(where.replaceAll('\\', '/')))) add(where, 'SEGREDO', label); // valores FALSOS de teste vivem em tests/
}

function scanPathName(where) {
  if (FORBIDDEN_OK.some(r => r.test(where))) return;
  if (FORBIDDEN_PATH.some(r => r.test(where))) add(where, 'CAMINHO PROIBIDO', 'não pode estar neste pacote/commit');
}

function scanFile(file, label) {
  scanPathName(label);
  scanBuffer(label, fs.readFileSync(file));
}

function scanZip(zip) {
  const list = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  for (const entry of list) {
    if (entry.endsWith('/')) continue;
    const label = `${path.basename(zip)}:${entry}`;
    scanPathName(entry);
    if (FORBIDDEN_PATH.some(r => r.test(entry)) && !FORBIDDEN_OK.some(r => r.test(entry))) continue;
    if (/\.zip$/i.test(entry)) { add(label, 'ZIP ANINHADO', 'pacote público não deve conter ZIPs'); continue; }
    const buf = execFileSync('unzip', ['-p', zip, entry], { maxBuffer: 1 << 28 });
    scanBuffer(label, buf);
  }
  return list.length;
}

function walk(dir, base = dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += walk(p, base); else { scanFile(p, path.relative(base, p)); n++; }
  }
  return n;
}

const args = process.argv.slice(2);
if (!args.length) { console.error('uso: leak-scan.mjs <arquivo|pasta|zip>... | --tracked'); process.exit(2); }
let scanned = 0;
for (const a of args) {
  if (a === '--tracked') {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
    for (const rel of out.split('\0').filter(Boolean)) { if (!fs.existsSync(path.join(ROOT, rel))) continue; scanFile(path.join(ROOT, rel), rel); scanned++; }
  } else if (/\.(zip|apk)$/i.test(a)) scanned += scanZip(a);
  else if (fs.statSync(a).isDirectory()) scanned += walk(a);
  else { scanFile(a, a); scanned++; }
}
console.log(`leak-scan: ${scanned} arquivo(s) verificado(s); varredura de nomes reais ${names.available ? `ATIVA (${names.tokens.length} tokens, ${names.phrases.length} frases)` : 'PULADA (sem seed local)'}; ${hashes.size} hash(es) de arquivos privados.`);
if (findings.length) {
  console.error(`\n✘ ${findings.length} achado(s):`);
  for (const f of findings) console.error(`  [${f.kind}] ${f.where} — ${f.detail}`);
  process.exit(1);
}
console.log('✔ nada privado encontrado.');
