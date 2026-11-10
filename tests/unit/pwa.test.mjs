import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), 'utf8');

test('sw.js pré-cacheia exatamente os scripts da Íris carregados pelo index.html', () => {
  const html = read('index.html'), sw = read('sw.js');
  const inHtml = [...html.matchAll(/<script defer src="(iris\/[^"]+)"/g)].map(m => './' + m[1]).sort();
  const inSw = [...sw.matchAll(/'(\.\/iris\/[^']+\.js)'/g)].map(m => m[1]).sort();
  assert.deepEqual(inSw, inHtml);
  for (const css of ['./iris/themes.css', './iris/iris.css']) assert.ok(sw.includes(css), css);
  for (const f of inHtml) assert.ok(fs.existsSync(new URL(f, root)), `${f} não existe`);
});
test('sw.js nunca cacheia /api/ e instala sem derrubar por asset ausente', () => {
  const sw = read('sw.js');
  assert.match(sw, /includes\('\/api\/'\)\) return/);
  assert.match(sw, /Promise\.allSettled/);
  assert.ok(!/addAll/.test(sw), 'addAll derruba a instalação inteira se 1 arquivo falhar');
});
test('manifest: válido, com atalho "Conversar com a Íris" que abre a assistente', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone'); assert.equal(m.lang, 'pt-BR');
  assert.equal(m.shortcuts[0].url, './index.html?iris=1'); assert.match(m.shortcuts[0].name, /Íris/);
  for (const i of m.icons) assert.ok(fs.existsSync(new URL(i.src, root)));
});
test('index.html não carrega nada de terceiros (sem CDN, fontes ou analytics)', () => {
  const html = read('index.html');
  const ext = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1]).filter(u => !/solutudo|mercadolivre|magazineluiza/.test(u));
  assert.deepEqual(ext, []);
});
