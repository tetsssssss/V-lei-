// Testes do backend opcional. Provedores: MOCK e um servidor UPSTREAM FALSO local.
// NÃO provam que Anthropic/OpenAI funcionam com chave real (não há chaves neste ambiente).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readConfig } from '../../server/lib/env.mjs';
import { createServer } from '../../server/server.mjs';
import { issueToken, verifyToken } from '../../server/lib/auth.mjs';
import { createLimiter } from '../../server/lib/ratelimit.mjs';
import { toOpenAIMessages } from '../../server/adapters/llm/openai-compatible.mjs';
import { seen } from '../../server/adapters/llm/mock.mjs';

const PASS = 'senha-de-teste-123', SECRET = 'segredo-de-teste-que-e-bem-longo-0123456789', KEY = ['sk', 'ant', 'CHAVE', 'FALSA', 'DE', 'TESTE', '0000000000000000'].join('-'); // montada em runtime: sem padrão de chave no código
const base = o => readConfig({ IRIS_PASSCODE: PASS, IRIS_TOKEN_SECRET: SECRET, IRIS_LLM_PROVIDER: 'mock', IRIS_STT_PROVIDER: 'mock', IRIS_TTS_PROVIDER: 'mock', ALLOWED_ORIGINS: 'https://app.exemplo.test', ANTHROPIC_API_KEY: KEY, ...o });
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
let servers = [], logs = [];
const realLog = console.log; console.log = (...a) => { logs.push(a.join(' ')); };
const start = async (cfg, opts) => { const s = createServer(cfg, opts); const port = await listen(s); servers.push(s); return `http://127.0.0.1:${port}`; };
const login = async url => (await (await fetch(`${url}/api/iris/session`, { method: 'POST', body: JSON.stringify({ passcode: PASS }) })).json()).token;
after(() => { console.log = realLog; servers.forEach(s => s.close()); });

test('health é público, só devolve booleanos e NUNCA valores de chaves/senha', async () => {
  const url = await start(base());
  const r = await fetch(`${url}/api/iris/health`); const t = await r.text();
  assert.equal(r.status, 200);
  const j = JSON.parse(t); assert.equal(j.llm.configured, true); assert.equal(j.auth, true);
  for (const secret of [PASS, SECRET, KEY]) assert.ok(!t.includes(secret), 'vazou segredo no /health');
});

test('sem senha/segredo no ambiente: rotas protegidas desativadas (503), health informa', async () => {
  const url = await start(readConfig({}));
  assert.equal((await fetch(`${url}/api/iris/health`)).status, 200);
  assert.equal((await fetch(`${url}/api/iris/chat`, { method: 'POST', body: '{}' })).status, 503);
  const h = await (await fetch(`${url}/api/iris/health`)).json(); assert.deepEqual([h.auth, h.llm.configured, h.configured], [false, false, false]);
});

test('login: senha errada 401, certa devolve token; token adulterado/expirado é rejeitado', async () => {
  const url = await start(base());
  assert.equal((await fetch(`${url}/api/iris/session`, { method: 'POST', body: JSON.stringify({ passcode: 'errada' }) })).status, 401);
  const token = await login(url); assert.ok(verifyToken(token, SECRET));
  assert.equal(verifyToken(token.slice(0, -2) + 'xx', SECRET), false, 'assinatura adulterada');
  assert.equal(verifyToken(token, 'outro-segredo-qualquer-123456'), false, 'segredo diferente');
  const old = issueToken(SECRET, { ttlMs: 1000, now: Date.now() - 5000 }); assert.equal(verifyToken(old.token, SECRET), false, 'expirado');
});

test('rate limit do login: 6ª tentativa errada leva 429', async () => {
  const url = await start(base());
  const codes = []; for (let i = 0; i < 6; i++) codes.push((await fetch(`${url}/api/iris/session`, { method: 'POST', body: JSON.stringify({ passcode: 'x' + i }) })).status);
  assert.deepEqual(codes.slice(0, 5), [401, 401, 401, 401, 401]); assert.equal(codes[5], 429);
});

test('limitador: janela deslizante', () => {
  let t = 0; const l = createLimiter({ windowMs: 1000, max: 2, now: () => t });
  assert.ok(l.check('a').ok && l.check('a').ok); assert.equal(l.check('a').ok, false); t = 1500; assert.ok(l.check('a').ok);
});

test('chat exige token; com token, o mock pede ferramenta; corpo grande e tools inválidas são recusados', async () => {
  const url = await start(base());
  const body = { messages: [{ role: 'user', content: 'me conta um segredo' }], tools: [{ name: 'calculateDaysUntilWedding', description: 'dias', input_schema: { type: 'object', properties: {} } }] };
  assert.equal((await fetch(`${url}/api/iris/chat`, { method: 'POST', body: JSON.stringify(body) })).status, 401);
  const token = await login(url), auth = { authorization: `Bearer ${token}` };
  const ok = await (await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: auth, body: JSON.stringify(body) })).json();
  assert.equal(ok.toolCalls[0].name, 'calculateDaysUntilWedding'); assert.equal(ok.provider, 'mock');
  assert.equal((await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: auth, body: JSON.stringify({ ...body, tools: [{ name: 'rm -rf', description: 'x', input_schema: {} }] }) })).status, 400);
  assert.equal((await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: auth, body: 'x'.repeat(70 * 1024) })).status, 413);
  assert.equal((await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: auth, body: '{ruim' })).status, 400);
});

test('STT e TTS (mock): tipo de áudio, tamanho e validação', async () => {
  const url = await start(base()); const auth = { authorization: `Bearer ${await login(url)}` };
  const stt = await fetch(`${url}/api/iris/stt`, { method: 'POST', headers: { ...auth, 'content-type': 'audio/webm' }, body: Buffer.from([1, 2, 3, 4]) });
  assert.equal((await stt.json()).text, 'quantos dias faltam');
  assert.equal((await fetch(`${url}/api/iris/stt`, { method: 'POST', headers: { ...auth, 'content-type': 'text/plain' }, body: 'x' })).status, 415);
  assert.equal((await fetch(`${url}/api/iris/stt`, { method: 'POST', headers: { ...auth, 'content-type': 'audio/webm' }, body: Buffer.alloc(6 * 1024 * 1024) })).status, 413);
  const tts = await fetch(`${url}/api/iris/tts`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'Olá' }) });
  assert.equal(tts.headers.get('content-type'), 'audio/wav'); assert.ok((await tts.arrayBuffer()).byteLength > 1000);
  assert.equal((await fetch(`${url}/api/iris/tts`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'a'.repeat(2000) }) })).status, 400);
});

test('CORS: origem não listada não recebe cabeçalho; listada recebe; preflight de origem estranha é 403', async () => {
  const url = await start(base());
  const bad = await fetch(`${url}/api/iris/health`, { headers: { origin: 'https://malicioso.test' } }); assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const good = await fetch(`${url}/api/iris/health`, { headers: { origin: 'https://app.exemplo.test' } }); assert.equal(good.headers.get('access-control-allow-origin'), 'https://app.exemplo.test');
  assert.equal((await fetch(`${url}/api/iris/chat`, { method: 'OPTIONS', headers: { origin: 'https://malicioso.test' } })).status, 403);
});

test('logs nunca contêm corpo, senha, token nem chave', async () => {
  const url = await start(base()); logs = [];
  const token = await login(url);
  await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: 'FRASE-PRIVADA-DO-CASAL-123' }] }) });
  const all = logs.join('\n'); assert.ok(logs.length >= 2);
  for (const s of [PASS, SECRET, KEY, token, 'FRASE-PRIVADA-DO-CASAL-123']) assert.ok(!all.includes(s), 'vazou nos logs');
  assert.match(all, /\[iris-api\] POST \/api\/iris\/chat 200/);
});

test('estáticos: nunca serve private/, .env, server/, ZIPs, PDFs e docs', async () => {
  const url = await start(base());
  for (const p of ['/private/seed.txt', '/server/.env.example', '/.env', '/server/lib/env.mjs', '/tests/e2e/lib.mjs', '/docs/COMO_RODAR_A_IRIS.md', '/x.zip', '/fontes.pdf', '/.git/config']) assert.equal((await fetch(url + p)).status, 404, p);
  const idx = await fetch(url + '/'); assert.equal(idx.status, 200); assert.match(await idx.text(), /<meta name="iris-api" content="\/api\/iris">/);
});

// ---------- adaptadores contra UPSTREAM FALSO (formato da requisição) ----------
async function fakeUpstream(handler) { const calls = []; const s = http.createServer(async (rq, rs) => { const chunks = []; for await (const c of rq) chunks.push(c); const call = { url: rq.url, headers: rq.headers, body: Buffer.concat(chunks) }; calls.push(call); handler(call, rs); }); servers.push(s); const port = await listen(s); return { url: `http://127.0.0.1:${port}`, calls }; }

test('Anthropic: cabeçalhos, mapeamento de ferramentas e resposta (upstream falso)', async () => {
  const up = await fakeUpstream((c, rs) => { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ content: [{ type: 'text', text: 'Ok.' }, { type: 'tool_use', id: 'tu_1', name: 'getBudgetSummary', input: {} }], stop_reason: 'tool_use' })); });
  const url = await start(base({ IRIS_LLM_PROVIDER: 'anthropic', ANTHROPIC_BASE_URL: up.url }));
  const token = await login(url);
  const r = await (await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }], tools: [{ name: 'getBudgetSummary', description: 'd', input_schema: { type: 'object', properties: {} } }], context: { dias: 368 } }) })).json();
  assert.deepEqual(r.toolCalls, [{ id: 'tu_1', name: 'getBudgetSummary', input: {} }]); assert.equal(r.text, 'Ok.');
  const call = up.calls[0], b = JSON.parse(call.body.toString());
  assert.equal(call.url, '/v1/messages'); assert.equal(call.headers['x-api-key'], KEY); assert.equal(call.headers['anthropic-version'], '2023-06-01');
  assert.equal(b.model, 'claude-sonnet-5-5'); assert.equal(b.tools[0].name, 'getBudgetSummary'); assert.match(b.system, /Íris/); assert.match(b.system, /"dias":368/);
  assert.ok(!('api_key' in b));
});

test('Anthropic: erro do provedor vira 502 genérico (sem repassar detalhes)', async () => {
  const up = await fakeUpstream((c, rs) => { rs.writeHead(500); rs.end('detalhe interno com chave sk-xxx'); });
  const url = await start(base({ IRIS_LLM_PROVIDER: 'anthropic', ANTHROPIC_BASE_URL: up.url })); const token = await login(url);
  const r = await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }) });
  assert.equal(r.status, 502); assert.ok(!(await r.text()).includes('sk-xxx'));
});

test('OpenAI-compatível: converte tool_use/tool_result e mapeia a resposta (upstream falso)', async () => {
  const msgs = toOpenAIMessages('SYS', [{ role: 'user', content: 'oi' }, { role: 'assistant', content: [{ type: 'tool_use', id: 'c1', name: 'f', input: { a: 1 } }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'resultado' }] }]);
  assert.deepEqual(msgs[2].tool_calls[0], { id: 'c1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } });
  assert.deepEqual(msgs[3], { role: 'tool', tool_call_id: 'c1', content: 'resultado' });
  const up = await fakeUpstream((c, rs) => { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'g', arguments: '{"b":2}' } }] } }] })); });
  const url = await start(base({ IRIS_LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'chave-openai-falsa', IRIS_LLM_MODEL: 'modelo-de-teste', OPENAI_BASE_URL: up.url })); const token = await login(url);
  const r = await (await fetch(`${url}/api/iris/chat`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }], tools: [{ name: 'g', description: 'd', input_schema: { type: 'object', properties: {} } }] }) })).json();
  assert.deepEqual(r.toolCalls, [{ id: 'x', name: 'g', input: { b: 2 } }]);
  assert.equal(up.calls[0].url, '/chat/completions'); assert.equal(up.calls[0].headers.authorization, 'Bearer chave-openai-falsa');
  assert.equal(JSON.parse(up.calls[0].body.toString()).tools[0].function.name, 'g'); assert.equal(JSON.parse(up.calls[0].body.toString()).model, 'modelo-de-teste');
});

test('STT/TTS OpenAI-compatíveis: multipart e JSON corretos (upstream falso)', async () => {
  const up = await fakeUpstream((c, rs) => { if (c.url.endsWith('/transcriptions')) { rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify({ text: ' bom dia ' })); } else { rs.writeHead(200, { 'content-type': 'audio/mpeg' }); rs.end(Buffer.from([9, 9, 9])); } });
  const url = await start(base({ IRIS_STT_PROVIDER: 'openai', IRIS_TTS_PROVIDER: 'openai', OPENAI_API_KEY: 'k-falsa', OPENAI_BASE_URL: up.url })); const auth = { authorization: `Bearer ${await login(url)}` };
  const s = await (await fetch(`${url}/api/iris/stt`, { method: 'POST', headers: { ...auth, 'content-type': 'audio/webm;codecs=opus' }, body: Buffer.from([1, 2, 3]) })).json(); assert.equal(s.text, 'bom dia');
  assert.match(up.calls[0].headers['content-type'], /^multipart\/form-data/); assert.match(up.calls[0].body.toString('latin1'), /name="language"\r\n\r\npt/); assert.match(up.calls[0].body.toString('latin1'), /name="model"\r\n\r\nwhisper-1/);
  const t = await fetch(`${url}/api/iris/tts`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'oi' }) }); assert.equal(t.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual(JSON.parse(up.calls[1].body.toString()), { model: 'tts-1', voice: 'nova', input: 'oi', response_format: 'mp3' });
});

test('OpenAI/ChatGPT: exige chave E modelo; o health lista só os NOMES do que falta', async () => {
  const a = await (await fetch(`${await start(base({ IRIS_LLM_PROVIDER: 'openai' }))}/api/iris/health`)).json();
  assert.equal(a.llm.configured, false); assert.deepEqual(a.llm.missing, ['OPENAI_API_KEY', 'IRIS_LLM_MODEL']);
  const b = await (await fetch(`${await start(base({ IRIS_LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k-falsa-de-teste' }))}/api/iris/health`)).json();
  assert.deepEqual(b.llm.missing, ['IRIS_LLM_MODEL']);
  const c = await (await fetch(`${await start(base({ IRIS_LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k-falsa-de-teste', IRIS_LLM_MODEL: 'modelo-de-teste' }))}/api/iris/health`)).json();
  assert.equal(c.llm.configured, true); assert.equal(c.llm.provider, 'openai'); assert.ok(!JSON.stringify(c).includes('k-falsa-de-teste'));
});
