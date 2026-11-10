// E2E do backend opcional com servidor REAL em processo (provedores MOCK). Mostra o que é real e o que é simulado:
//  REAL: HTTP, login, token, laço de ferramentas no navegador, portão de risco, MediaRecorder com microfone FALSO do Chromium.
//  SIMULADO: a "inteligência" (mock) e o áudio de teste. NÃO prova qualidade de IA/voz real nem os serviços pagos.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './lib.mjs';
import { makeReporter, sleep } from './lib.mjs';
import { readConfig } from '../../server/lib/env.mjs';
import { createServer } from '../../server/server.mjs';
import { seen } from '../../server/adapters/llm/mock.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';

const R = makeReporter('BACKEND + IA EXTERNA (mock)'); const { check } = R;
const PASS = 'senha-de-teste-123', KEY = ['sk', 'ant', 'CHAVE', 'FALSA', 'DE', 'TESTE', '0000000000000000'].join('-');
const cfg = readConfig({ IRIS_PASSCODE: PASS, IRIS_TOKEN_SECRET: 'segredo-de-teste-que-e-bem-longo-0123456789', IRIS_LLM_PROVIDER: 'mock', IRIS_STT_PROVIDER: 'mock', IRIS_TTS_PROVIDER: 'mock', ANTHROPIC_API_KEY: KEY });
const reqs = []; const realLog = console.log; console.log = (...a) => { const t = a.join(' '); if (t.startsWith('[iris-api]')) reqs.push(t); };
const srv = createServer(cfg); await new Promise(r => srv.listen(0, '127.0.0.1', r)); const URL_ = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const FAKE_SPEECH = () => { window.__s = { rec: 0, spoken: 0 }; window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { window.__s.rec++; } stop() {} abort() {} }; window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } }; Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {}, speak(u) { window.__s.spoken++; setTimeout(() => u.onend && u.onend(), 10); } }, configurable: true }); localStorage.setItem('nosso-sim-iris-v1', JSON.stringify({ prefs: { introDone: true, briefingOnOpen: false, speakOn: false }, consent: { voice: true, externalAI: false, level: 0 } })); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'], serviceWorkers: 'block' });
await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [STORAGE_KEY, JSON.stringify(fixtureV2())]);
await ctx.addInitScript(FAKE_SPEECH);
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errs.push(m.text()); }); // o 401 do teste de senha errada é intencional
await page.goto(URL_); await page.waitForSelector('#content');
const settle = () => page.waitForFunction(() => ['idle', 'error'].includes(document.querySelector('.iris-orb')?.getAttribute('data-state')), null, { timeout: 8000 }).then(() => sleep(80));
const say = async t => { await page.fill('#iris-input', t); await page.press('#iris-input', 'Enter'); await sleep(50); await settle(); };
const last = () => page.locator('.iris-msg--iris').last().innerText();
const count = rx => reqs.filter(r => rx.test(r)).length;
const state = k => page.evaluate(k2 => JSON.parse(localStorage.getItem(k2)), STORAGE_KEY);
try {
  await page.click('.iris-fab'); await settle();
  // 1) sem login/consentimento: nada vai ao backend
  await say('Íris, me conta um segredo sobre o casamento');
  check('sem login e sem consentimento: o motor local responde e NADA vai ao backend', /Não entendi bem/.test(await last()) && count(/\/chat/) === 0 && count(/\/stt|\/tts/) === 0);
  // 2) configurações: status honesto + login
  await page.click('.iris-icon-btn[aria-label="Configurações da Íris"]'); await page.waitForSelector('#iris-pass');
  const st = await page.locator('.iris-drawer:not([hidden])').innerText();
  check('configurações mostram "IA: mock", voz→texto e voz externas disponíveis', /IA: mock/.test(st) && /Voz→texto externa/.test(st) && /Voz externa/.test(st));
  await page.fill('#iris-pass', 'senha-errada'); await page.press('#iris-pass', 'Enter'); await page.waitForFunction(() => /Senha incorreta/.test(document.getElementById('iris-pass-msg')?.textContent || ''));
  check('senha errada: mensagem clara e continua deslogado', true);
  await page.fill('#iris-pass', PASS); await page.press('#iris-pass', 'Enter'); await page.waitForSelector('#iris-sw-ext');
  check('login ok: "Conectado ao backend"', /Conectado ao backend/.test(await page.locator('.iris-drawer:not([hidden])').innerText()));
  check('token só em sessionStorage (nunca localStorage) e nenhuma chave no navegador', await page.evaluate(([key, pass]) => { const l = JSON.stringify(Object.assign({}, localStorage)), s = JSON.stringify(Object.assign({}, sessionStorage)); return !!sessionStorage.getItem('iris-token') && !l.includes(sessionStorage.getItem('iris-token')) && ![l, s, document.documentElement.outerHTML].some(t => t.includes(key) || t.includes(pass)); }, [KEY, PASS]));
  check('IA externa fica DESLIGADA até o casal ligar (consentimento explícito)', (await page.evaluate(() => Iris.app.store.get().consent.externalAI)) === false);
  await page.evaluate(() => document.getElementById('iris-sw-ext').click()); await sleep(100);
  check('…e liga somente quando o casal liga', (await page.evaluate(() => Iris.app.store.get().consent.externalAI)) === true);
  await page.click('.iris-drawer:not([hidden]) .iris-icon-btn[aria-label="Voltar"]');
  // 3) IA externa: o mock propõe uma ferramenta; o navegador a executa localmente
  seen.length = 0; await say('Íris, me conta um segredo sobre o casamento');
  check('motor local não entendeu → IA externa propôs ferramenta → resultado foi lido do app', /resposta simulada/.test(await last()) && count(/POST \/api\/iris\/chat 200/) >= 2);
  const sent = JSON.stringify(seen);
  check('nível 0: só totais e contagens saem do aparelho (nenhum nome de convidado/fornecedor)', /pessoasPrevistas/.test(sent) && !/Fictício|Fictícia|Buffet Exemplo|Chácara Exemplo/.test(sent), sent.slice(0, 200));
  check('resultado de ferramenta com nomes é omitido no nível 0', !/Fictício/.test(sent));
  await page.evaluate(() => Iris.app.store.setConsent('level', 1)); seen.length = 0; await say('Íris, me conta um segredo sobre o casamento');
  check('nível 1: acrescenta nomes de fornecedores, mas ainda sem nomes de convidados', /Buffet Exemplo/.test(JSON.stringify(seen)) && !/Convidado Fictício/.test(JSON.stringify(seen)));
  await page.evaluate(() => Iris.app.store.setConsent('level', 2)); seen.length = 0; await say('Íris, me conta um segredo sobre o casamento');
  check('nível 2: só então nomes de convidados são incluídos', /Convidado Fictício/.test(JSON.stringify(seen)));
  await page.evaluate(() => Iris.app.store.setConsent('level', 0));
  // 4) proposta perigosa da IA: o portão de risco continua valendo
  const before = (await state()).guests.length;
  await say('Íris, quero sumir com os dados dos convidados');
  check('a IA propôs excluir → vira confirmação SENSÍVEL na tela; nada é apagado sozinho', (await page.locator('.iris-pending').isVisible()) && (await state()).guests.length === before);
  await page.click('#iris-cancel'); await settle();
  // 5) STT remoto com microfone FALSO (MediaRecorder real) → backend mock
  await page.evaluate(() => { Iris.app.store.setPref('sttEngine', 'remote'); Iris.app.store.setPref('ttsEngine', 'remote'); Iris.app.store.setPref('speakOn', true); });
  const s0 = count(/POST \/api\/iris\/stt 200/), t0 = count(/POST \/api\/iris\/tts 200/), spoken0 = await page.evaluate(() => window.__s.spoken);
  await page.click('.iris-mic'); await page.waitForFunction(() => document.querySelector('.iris-orb')?.getAttribute('data-state') === 'listening', null, { timeout: 6000 });
  await sleep(1200); await page.click('.iris-mic'); await settle();
  check('STT externo: áudio gravado de verdade (microfone falso) foi ao backend e voltou como texto', count(/POST \/api\/iris\/stt 200/) === s0 + 1 && /quantos dias faltam/.test(await page.locator('.iris-msg--you').last().innerText()));
  check('o SpeechRecognition do navegador NÃO foi usado nesse modo', (await page.evaluate(() => window.__s.rec)) === 0);
  await sleep(400);
  check('TTS externo: a resposta foi sintetizada pelo backend (e não pelo speechSynthesis)', count(/POST \/api\/iris\/tts 200/) >= t0 + 1 && (await page.evaluate(() => window.__s.spoken)) === spoken0);
  // 6) sair apaga o token; IA externa deixa de ser usada
  await page.click('.iris-icon-btn[aria-label="Configurações da Íris"]'); await page.waitForSelector('button:has-text("Sair")'); await page.click('button:has-text("Sair")'); await sleep(200);
  check('"Sair" remove o token e desliga a IA externa', (await page.evaluate(() => sessionStorage.getItem('iris-token'))) === null && (await page.evaluate(() => Iris.app.store.get().consent.externalAI)) === false);
  check('sem erros de console/página', errs.length === 0, errs.join(' | '));
} finally { console.log = realLog; await browser.close(); srv.close(); }
const { failed } = R.summary(); process.exit(failed.length ? 1 : 0);
