// O scanner precisa PEGAR vazamentos plantados (senão "nada encontrado" não significa nada).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
const SCAN = new URL('../../scripts/leak-scan.mjs', import.meta.url).pathname;
const SEED = new URL('../../seed/seed-casal.js', import.meta.url).pathname;
const run = file => spawnSync('node', [SCAN, file], { encoding: 'utf8' });
const tmp = (name, body) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-')); const f = path.join(d, name); fs.writeFileSync(f, body); return f; };

test('arquivo limpo passa', () => { assert.equal(run(tmp('ok.js', 'const a = 1; // nada aqui')).status, 0); });
test('chave de API plantada é detectada (Anthropic e atribuição genérica)', () => {
  assert.equal(run(tmp('k.js', "const k = '" + ['sk', 'ant', 'api03', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'].join('-') + "';")).status, 1);
  assert.equal(run(tmp('c.js', 'ANTHROPIC_API_KEY=abcdefghijklmnopqrstuvwxyz012345')).status, 1);
});
test('.env e PDF em pacote são caminhos proibidos', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-')); fs.writeFileSync(path.join(d, '.env'), 'X=1'); fs.writeFileSync(path.join(d, 'lista.pdf'), 'x');
  const r = spawnSync('node', [SCAN, d], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.match(r.stderr, /CAMINHO PROIBIDO/);
});
test('.env.example é permitido', () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-')); fs.writeFileSync(path.join(d, '.env.example'), 'IRIS_PASSCODE='); assert.equal(spawnSync('node', [SCAN, d], { encoding: 'utf8' }).status, 0); });
test('nome REAL de convidado (lido do seed local) é detectado; sem seed, o teste é pulado', { skip: !fs.existsSync(SEED) }, () => {
  const w = {}; vm.runInNewContext(fs.readFileSync(SEED, 'utf8'), { window: w });
  const name = w.NS_SEED.guests.find(g => /\+/.test(g.name)).name; // primeiro convite com nome composto, lido em tempo de execução
  const r = run(tmp('lista.js', `const convidado = ${JSON.stringify(name)};`));
  assert.equal(r.status, 1); assert.match(r.stderr, /NOME REAL/);
});
