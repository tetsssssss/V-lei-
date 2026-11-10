// E2E da Íris. ATENÇÃO — o que é REAL e o que é SIMULADO neste arquivo:
//  REAL     : DOM, layout, permissão de microfone (dispositivo falso do Chromium), persistência, estado do app, requests.
//  SIMULADO : SpeechRecognition (stub) e speechSynthesis (stub). O Chromium headless não tem Google STT nem vozes.
//  => Isto NÃO prova que o microfone/voz funcionam num celular. Para isso: tests/roteiro_teste_telefone.md.
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, makeReporter, openPage, VIEWPORTS, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '.'));
const SHOTS = arg('--shots', '');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const R = makeReporter('ÍRIS E2E (voz SIMULADA)');
const { check } = R;
const IRIS_KEY = 'nosso-sim-iris-v1';

// ---- stubs de fala (SIMULADOS) ----
const FAKE_SPEECH = () => {
  window.__speech = { spoken: [], recStarts: 0, cancelled: 0, nextTranscript: 'quantos dias faltam', mode: 'ok', delay: 120, speakMs: 150 };
  const S = window.__speech;
  class FakeRec {
    start() {
      S.recStarts++; setTimeout(() => this.onstart && this.onstart(), 10); setTimeout(() => this.onaudiostart && this.onaudiostart(), 20);
      if (S.mode === 'ok') this._t = setTimeout(() => { this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: S.nextTranscript }], { isFinal: true })] }); this._t2 = setTimeout(() => this.onend && this.onend(), 20); }, S.delay);
      else if (S.mode === 'no-speech') this._t = setTimeout(() => { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); }, 100);
      else if (S.mode === 'network') this._t = setTimeout(() => { this.onerror && this.onerror({ error: 'network' }); this.onend && this.onend(); }, 100);
      else if (S.mode === 'partial') this._t = setTimeout(() => { this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'quantos dias' }], { isFinal: false })] }); }, 80);
    }
    stop() { clearTimeout(this._t); if (S.mode === 'partial') this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: S.nextTranscript }], { isFinal: true })] }); setTimeout(() => this.onend && this.onend(), 10); }
    abort() { clearTimeout(this._t); clearTimeout(this._t2); S.aborted = (S.aborted || 0) + 1; setTimeout(() => this.onend && this.onend(), 5); }
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeRec;
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const voices = [{ name: 'Microsoft Francisca Online (Natural)', lang: 'pt-BR', voiceURI: 'fr', localService: false }, { name: 'Google português do Brasil', lang: 'pt-BR', voiceURI: 'gpt', localService: false }, { name: 'Daniel', lang: 'pt-BR', voiceURI: 'dn', localService: true }, { name: 'English', lang: 'en-US', voiceURI: 'en', localService: true }];
  const synth = { getVoices: () => voices, addEventListener() {}, removeEventListener() {},
    cancel() { S.cancelled++; if (this._cur) { const u = this._cur; this._cur = null; u.onerror && u.onerror({ error: 'canceled' }); } },
    speak(u) { S.spoken.push(u.text); this._cur = u; setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => { if (this._cur === u) { this._cur = null; u.onend && u.onend(); } }, S.speakMs); } };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
};
const combine = (...fns) => ({ content: fns.map(f => `(${f})();`).join('\n') }); // scripts auto-contidos (funções são serializadas)
const NO_SPEECH_API = () => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; };
const MIC_DENIED = () => { try { navigator.permissions.query = async () => ({ state: 'denied' }); } catch (_) {} };

const srv = await startServer(ROOT);
const browser = await launch();
const fix = JSON.stringify(fixtureV2());
const lastIris = page => page.locator('.iris-msg--iris').last().innerText();
const state = page => page.evaluate(() => document.querySelector('.iris-orb').getAttribute('data-state'));
const waitState = (page, s, t = 4000) => page.waitForFunction(x => document.querySelector('.iris-orb')?.getAttribute('data-state') === x, s, { timeout: t });
const store = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), STORAGE_KEY);
const type = async (page, text) => { await page.fill('#iris-input', text); await page.press('#iris-input', 'Enter'); };
const settle = async (page) => { await page.waitForFunction(() => ['idle', 'error', 'offline'].includes(document.querySelector('.iris-orb')?.getAttribute('data-state')), null, { timeout: 5000 }); await sleep(60); };

try {
  // ============ 1) carga, FAB, abrir, introdução (1x), consentimento, sem rede externa ============
  {
    const { context, page, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH, permissions: ['microphone'] });
    check('FAB da Íris existe em qualquer tela', await page.locator('.iris-fab').isVisible());
    check('entrada "Conversar com a Íris" no menu (Mais)', await page.evaluate(() => { document.querySelector('[data-action="more"]').click(); const ok = !!document.querySelector('#modal-root [data-section="iris"]'); document.querySelector('#modal-root [data-action="close"]').click(); return ok; }));
    await page.click('.iris-fab');
    check('tela de voz abre', await page.locator('#iris-root').isVisible());
    check('orbe fala a introdução (estado "speaking")', (await state(page)) === 'speaking');
    await page.waitForFunction(() => window.__speech.spoken.length >= 1);
    await settle(page);
    check('orbe volta ao estado "idle" ao terminar', (await state(page)) === 'idle');
    const intro = await lastIris(page);
    check('frase inicial personalizada (nomes do casal)', /Oi, Gabriel e Isabelle! Eu sou a Íris\. Posso ajudar vocês a organizar o casamento\. Por onde começamos\?/.test(intro), intro);
    check('frase inicial é falada 1x após o gesto de abrir', (await page.evaluate(() => window.__speech.spoken.length)) === 1);
    await page.click('.iris-icon-btn[aria-label="Fechar a conversa"]');
    await page.click('.iris-fab');
    const intros = await page.locator('.iris-msg--iris', { hasText: 'Eu sou a Íris' }).count();
    check('apresentação NÃO se repete a cada acesso', intros === 1, `n=${intros}`);
    check('mic tem aria-label e aria-pressed', (await page.getAttribute('.iris-mic', 'aria-pressed')) === 'false' && !!(await page.getAttribute('.iris-mic', 'aria-label')));
    check('zero requests externos / sem erros', log.external.length === 0 && log.errors.length === 0 && log.console.length === 0, [...log.external, ...log.errors, ...log.console].join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'iris-390-aberta.png') });
    await context.close();
  }

  // ============ 2) modo TEXTO completo: dias, cenário hipotético (cancelar/confirmar/desfazer), persistência ============
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH });
    await page.click('.iris-fab'); await settle(page);
    await type(page, 'Íris, quantos dias faltam?'); await settle(page);
    const d = await lastIris(page);
    check('"quantos dias faltam" responde com a data vigente', /Faltam \d+ dias/.test(d) && /referência/.test(d), d);
    await type(page, 'adicione despesa hipotética R$ 300'); await settle(page);
    check('pede confirmação antes de gravar (cartão com antes/depois)', await page.locator('.iris-pending').isVisible() && /Entra nos totais\?/.test(await page.locator('.iris-pending').innerText()));
    let s = await store(page); check('nada gravado antes de confirmar', s.budget.length === 2);
    await type(page, 'não, cancele'); await settle(page);
    s = await store(page); check('"não, cancele" cancela e nada muda', s.budget.length === 2 && !(await page.locator('.iris-pending').isVisible()));
    await type(page, 'adicione despesa hipotética R$ 300'); await settle(page);
    await page.click('#iris-confirm'); await settle(page);
    s = await store(page);
    const hyp = s.budget.find(x => x.hypothetical);
    check('"confirme" grava a hipótese (fora dos totais)', s.budget.length === 3 && hyp && hyp.estimate === 300);
    await page.reload(); await page.waitForSelector('#content');
    s = await store(page); check('hipótese persiste após recarregar a página', s.budget.some(x => x.hypothetical && x.estimate === 300));
    await page.click('.iris-fab'); await settle(page);
    const hist = await page.locator('.iris-msg').count();
    check('conversa anterior reaparece após recarregar (mantém contexto)', hist >= 4, `msgs=${hist}`);
    await type(page, 'mostre saldo'); await settle(page);
    check('"mostre saldo" cita as hipóteses separadas', /hipóteses/.test(await lastIris(page)), await lastIris(page));
    await type(page, 'desfaça'); await settle(page);
    s = await store(page); check('"desfaça" remove e restaura o estado', s.budget.length === 2 && !s.budget.some(x => x.hypothetical));
    const audit = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).audit.map(a => `${a.tool}:${a.status}`), IRIS_KEY);
    check('auditoria registra cancelada, executada e desfeita', audit.join(',').includes('cancelled') && audit.join(',').includes('undone'), audit.join(','));
    const kv = await page.evaluate(k => localStorage.getItem(k), STORAGE_KEY);
    check('estado da Íris em chave separada (backup do app não é poluído)', !/"conversation"/.test(kv));
    await context.close();
  }

  // ============ 3) VOZ (SIMULADA): consentimento, ouvir, responder falando, interromper (barge-in), conversar de novo ============
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH, permissions: ['microphone'] });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(() => { window.__speech.spoken.length = 0; window.__speech.recStarts = 0; });
    await page.click('.iris-mic');
    check('1º uso: pede consentimento ANTES de ligar o microfone', await page.locator('.iris-consent').isVisible() && (await page.evaluate(() => window.__speech.recStarts)) === 0);
    await page.click('.iris-consent .iris-btn--primary');
    await waitState(page, 'listening');
    check('estado "ouvindo" e aria-pressed no botão', (await page.getAttribute('.iris-mic', 'aria-pressed')) === 'true');
    await settle(page);
    check('voz→texto→resposta: pergunta transcrita aparece na legenda', /quantos dias faltam/.test(await page.locator('.iris-msg--you').last().innerText()));
    check('resposta é FALADA (stub) com valores normalizados', (await page.evaluate(() => window.__speech.spoken.join(' | '))).match(/Faltam \d+ dias/) !== null);
    // barge-in: fala longa → toque no mic interrompe e já escuta
    await page.evaluate(() => { window.__speech.speakMs = 6000; window.__speech.nextTranscript = 'quanto falta organizar'; window.__speech.mode = 'ok'; window.__speech.delay = 5000; });
    await page.evaluate(() => { Iris.app.session.speakText('Esta é uma resposta longa para testar a interrupção da fala pela pessoa.'); });
    await waitState(page, 'speaking');
    const c0 = await page.evaluate(() => window.__speech.cancelled), r0 = await page.evaluate(() => window.__speech.recStarts);
    await page.click('.iris-mic');
    await waitState(page, 'listening');
    check('barge-in: tocar no mic corta a fala e já começa a ouvir', (await page.evaluate(() => window.__speech.cancelled)) > c0 && (await page.evaluate(() => window.__speech.recStarts)) === r0 + 1);
    await page.click('.iris-mic'); // enviar (stop)
    await page.evaluate(() => { window.__speech.speakMs = 100; });
    await sleep(100); await page.evaluate(() => { window.__speech.delay = 50; });
    await settle(page);
    // "para de falar" interrompe a fala imediatamente
    await page.evaluate(() => { window.__speech.speakMs = 6000; Iris.app.session.speakText('Outra resposta longa que será interrompida por comando de voz agora mesmo.'); });
    await waitState(page, 'speaking');
    await type(page, 'Íris, para de falar'); await settle(page);
    check('"para de falar" interrompe o TTS e volta a "idle"', (await state(page)) === 'idle');
    await page.evaluate(() => { window.__speech.speakMs = 120; });
    // "repete mais devagar" fala de novo mais lento
    await type(page, 'Íris, quantos dias faltam?'); await settle(page);
    const before = await page.evaluate(() => window.__speech.spoken.length);
    await type(page, 'Íris, repete mais devagar'); await settle(page);
    check('"repete mais devagar" fala de novo', (await page.evaluate(() => window.__speech.spoken.length)) > before);
    await context.close();
  }

  // ============ 4) falhas: sem SpeechRecognition, permissão negada, sem fala, rede ============
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: combine(FAKE_SPEECH, NO_SPEECH_API) });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k) || '{}'); }, IRIS_KEY);
    await page.evaluate(() => Iris.app.store.setConsent('voice', true));
    await page.click('.iris-mic');
    await page.waitForSelector('.iris-msg--error');
    check('sem SpeechRecognition: mensagem clara + texto continua funcionando', /não tem reconhecimento de voz/.test(await page.locator('.iris-msg--error').last().innerText()));
    await type(page, 'quantos dias faltam'); await settle(page);
    check('…e o campo de texto responde normalmente', /Faltam/.test(await lastIris(page)));
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: combine(FAKE_SPEECH, MIC_DENIED) });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(() => Iris.app.store.setConsent('voice', true));
    await page.click('.iris-mic'); await page.waitForSelector('.iris-msg--error');
    check('permissão NEGADA: explica como liberar e NÃO inicia escuta', /bloqueado/.test(await page.locator('.iris-msg--error').last().innerText()) && (await page.evaluate(() => window.__speech.recStarts)) === 0);
    await context.close();
  }
  for (const [mode, rx] of [['no-speech', /Não ouvi nada/], ['network', /Sem conexão com o serviço de voz/]]) {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH, permissions: ['microphone'] });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(m => { Iris.app.store.setConsent('voice', true); window.__speech.mode = m; }, mode);
    await page.click('.iris-mic'); await page.waitForSelector('.iris-msg--error');
    check(`erro de STT "${mode}" tratado com mensagem acionável`, rx.test(await page.locator('.iris-msg--error').last().innerText()));
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH, permissions: ['microphone'] });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(() => { Iris.app.store.setConsent('voice', true); window.__speech.mode = 'partial'; });
    await page.click('.iris-mic'); await waitState(page, 'listening');
    await page.waitForFunction(() => /quantos dias/.test(document.querySelector('.iris-partial').textContent));
    check('transcrição PARCIAL aparece enquanto ouve', true);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await sleep(100);
    check('fechar/ocultar a aba durante a captura aborta o STT', (await state(page)) === 'idle' && (await page.evaluate(() => window.__speech.aborted)) >= 1);
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH, permissions: ['microphone'] });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(() => { Iris.app.store.setConsent('voice', true); Iris.app.store.setPref('reviewBeforeSend', true); window.__speech.mode = 'ok'; });
    await page.click('.iris-mic'); await page.waitForFunction(() => document.querySelector('#iris-input').value !== ''); await sleep(80);
    check('"revisar antes de enviar": texto vai ao campo, editável, sem enviar', (await page.inputValue('#iris-input')) === 'quantos dias faltam' && (await page.locator('.iris-msg--you').count()) === 0);
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH, permissions: ['microphone'] });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(() => Iris.app.store.setConsent('voice', true));
    await context.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }));
    await page.click('.iris-mic'); await page.waitForSelector('.iris-msg--error');
    check('sem internet: estado "offline" e orientação para digitar', /Sem internet/.test(await page.locator('.iris-msg--error').last().innerText()));
    await context.close();
  }

  // ============ 5) comando composto, peek, tema, ação sensível ============
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH });
    await page.click('.iris-fab'); await settle(page);
    await type(page, 'Íris, mostra nossos padrinhos e me diga quanto ainda falta organizar'); await settle(page);
    const t = await lastIris(page);
    check('composto: abre Padrinhos E diz o que falta organizar', /Padrinhos/.test(t) && /ainda falta/.test(t), t);
    check('o app mostrou a seção Padrinhos', /padrinhos/i.test(await page.locator('#content h1').first().innerText()));
    check('modo "espiar": a tela de voz encolhe para ver o app', (await page.getAttribute('#iris-root', 'data-mode')) === 'peek');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'iris-390-peek-padrinhos.png') });
    await type(page, 'muda para o tema Jarvis'); await settle(page);
    check('tema Jarvis por voz', (await page.getAttribute('#iris-root', 'data-iris-theme')) === 'jarvis');
    await type(page, 'volta para o tema romântico'); await settle(page);
    await type(page, 'exclui o convidado Convidada Fictícia C'); await settle(page);
    check('excluir é AÇÃO SENSÍVEL: exige toque', /Ação sensível/.test(await page.locator('.iris-pending').innerText()));
    await type(page, 'sim, confirmo'); await settle(page);
    check('voz sozinha não executa a ação sensível', (await store(page)).guests.length === 3);
    await page.click('#iris-confirm'); await settle(page);
    check('toque executa e permite desfazer', (await store(page)).guests.length === 2);
    await type(page, 'desfaça'); await settle(page);
    check('desfazer restaura o convidado', (await store(page)).guests.length === 3);
    await context.close();
  }

  // ============ 6) layout: 5 viewports, sem sobreposição / rolagem horizontal, mic e campo visíveis ============
  for (const vp of VIEWPORTS) {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: vp.width, height: vp.height }, init: FAKE_SPEECH });
    const fabBox = await page.locator('.iris-fab').boundingBox();
    const nav = await page.locator('#mobile-nav').boundingBox();
    const navVisible = await page.locator('#mobile-nav').isVisible();
    check(`FAB não cobre a barra de navegação em ${vp.name}`, !navVisible || (fabBox.y + fabBox.height <= nav.y + 1), JSON.stringify({ fabBox, nav }));
    await page.click('.iris-fab'); await settle(page);
    const m = await page.evaluate(() => {
      const r = id => { const e = document.querySelector(id); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height }; };
      return { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, mic: r('.iris-mic'), input: r('#iris-input'), orb: r('.iris-orb'), sheet: r('.iris-sheet'), log: r('.iris-log') };
    });
    check(`sem rolagem horizontal com a Íris aberta em ${vp.name}`, m.sw <= m.vw + 1, `sw=${m.sw} vw=${m.vw}`);
    check(`mic grande, visível e ≥48px em ${vp.name}`, m.mic && m.mic.w >= 48 && m.mic.bottom <= m.vh + 1 && m.mic.top >= 0, JSON.stringify(m.mic));
    check(`campo de texto visível em ${vp.name}`, m.input && m.input.bottom <= m.vh + 1 && m.input.h >= 40);
    check(`legendas têm espaço útil em ${vp.name}`, m.log && m.log.h >= 80, `log.h=${m.log && m.log.h}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `iris-${vp.name}.png`) });
    await context.close();
  }
} finally {
  await browser.close(); await srv.close();
}
const { failed } = R.summary();
process.exit(failed.length ? 1 : 0);
