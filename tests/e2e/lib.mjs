// Utilitários dos testes e2e: servidor estático local, Playwright, asserts com relatório.
// Dados de teste são FICTÍCIOS (ver fixture.mjs). Nada aqui lê dados reais.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const { chromium, devices } = require('playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

/** Servidor estático mínimo (sem dependências). Retorna { url, close, hits }. */
export function startServer(root, port = 0) {
  const hits = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    hits.push(`${req.method} ${u.pathname}`);
    if (!file.startsWith(path.resolve(root))) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => {
    const { port: p } = server.address();
    resolve({ url: `http://127.0.0.1:${p}/`, close: () => new Promise(r => server.close(r)), hits });
  }));
}

export const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '430x932', width: 430, height: 932 },
  { name: '1440x900', width: 1440, height: 900 },
];

export async function launch(extraArgs = []) {
  return chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...extraArgs] });
}

/** Coletor de resultados: check(nome, condição, detalhe). */
export function makeReporter(title) {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok, detail: String(detail ?? '') });
    console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail && !ok ? `  → ${detail}` : ''}`);
    return !!ok;
  };
  const summary = () => {
    const failed = results.filter(r => !r.ok);
    console.log(`\n${title}: ${results.length - failed.length}/${results.length} ok, ${failed.length} falha(s)`);
    if (failed.length) failed.forEach(f => console.log(`  ✘ ${f.name} ${f.detail}`));
    return { results, failed };
  };
  return { check, summary, results };
}

/** Abre uma página com monitoramento de console/pageerror/requests externos. */
export async function openPage(browser, baseUrl, { viewport, storage, init, url, permissions } = {}) {
  const context = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 }, permissions: permissions || [], serviceWorkers: 'block' });
  if (storage) {
    await context.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch (_) {} }, storage);
  }
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const log = { console: [], errors: [], external: [], requests: [] };
  page.on('console', m => { if (m.type() === 'error') log.console.push(m.text()); });
  page.on('pageerror', e => log.errors.push(String(e)));
  page.on('request', r => {
    log.requests.push(r.url());
    const u = new URL(r.url());
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) log.external.push(r.url());
  });
  await page.goto(url || baseUrl);
  await page.waitForSelector('#content');
  return { context, page, log };
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
