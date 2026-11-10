#!/usr/bin/env node
// Servidor local/hospedável: API da Íris + (opcional) arquivos estáticos do app, para desenvolvimento em localhost.
//   node server/server.mjs            → http://localhost:8080   (lê server/.env se existir)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnv, readConfig, capabilities } from './lib/env.mjs';
import { createApp } from './handlers/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const BLOCKED = /^\/(private|server|tests|scripts|docs|netlify|node_modules|\.git|dist|backups)(\/|$)|(^|\/)\.env|\.zip$|\.pdf$|\.md$/i; // nunca serve estes caminhos

export function createServer(cfg, { serveStatic = true, fetchImpl } = {}) {
  const app = createApp(cfg, { fetchImpl });
  return http.createServer(async (nreq, nres) => {
    try {
      const url = new URL(nreq.url, 'http://localhost');
      if (url.pathname.startsWith('/api/iris')) {
        const chunks = []; if (!['GET', 'HEAD'].includes(nreq.method)) for await (const c of nreq) chunks.push(c);
        const req = new Request(url, { method: nreq.method, headers: nreq.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
        const res = await app.handle(req, { ip: nreq.socket.remoteAddress });
        nres.writeHead(res.status, Object.fromEntries(res.headers)); return nres.end(Buffer.from(await res.arrayBuffer()));
      }
      if (!serveStatic || !['GET', 'HEAD'].includes(nreq.method)) { nres.writeHead(404).end('not found'); return; }
      let rel = decodeURIComponent(url.pathname); if (rel.endsWith('/')) rel += 'index.html';
      if (BLOCKED.test(rel) && rel !== '/LEIA-ME.txt') { nres.writeHead(404).end('not found'); return; }
      const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(ROOT)) { nres.writeHead(403).end('forbidden'); return; }
      let buf; try { buf = fs.readFileSync(file); } catch (_) { nres.writeHead(404).end('not found'); return; }
      // injeta o endpoint da Íris no index.html (o backend e o app estão na mesma origem)
      if (path.basename(file) === 'index.html') buf = Buffer.from(buf.toString('utf8').replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <meta name="iris-api" content="/api/iris">'));
      nres.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); nres.end(buf);
    } catch (e) { nres.writeHead(500).end('erro interno'); }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadDotEnv(path.join(here, '.env'));
  const cfg = readConfig(), c = capabilities(cfg);
  createServer(cfg).listen(cfg.port, '127.0.0.1', () => {
    console.log(`Íris · http://localhost:${cfg.port}   (apenas localhost)`);
    console.log(`  senha/token: ${c.auth ? 'configurados' : 'AUSENTES (rotas protegidas desativadas)'} · LLM: ${c.llm.configured ? c.llm.provider : 'não configurado'} · STT: ${c.stt.configured ? 'sim' : 'não'} · TTS: ${c.tts.configured ? 'sim' : 'não'}`);
  });
}
