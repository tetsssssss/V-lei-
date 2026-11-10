// Lado JavaScript do APK, com a ponte `window.IrisAndroid` SIMULADA (stub). NÃO executa o Java nem roda num Android.
import path from 'node:path';
import { startServer, launch, makeReporter, openPage, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';
const ROOT = path.resolve(process.argv[2] || '.'); const R = makeReporter('PONTE ANDROID (JS, ponte SIMULADA)'); const { check } = R;
const BRIDGE = () => {
  delete window.SpeechRecognition; delete window.webkitSpeechRecognition; // o WebView do Android não tem Web Speech
  const calls = []; window.__calls = calls; let mic = false;
  window.IrisAndroid = {
    version: () => '3.0', isRecognitionAvailable: () => true, hasMicPermission: () => mic, hasPtVoice: () => true, isTtsReady: () => true,
    requestMicPermission() { calls.push('requestMic'); setTimeout(() => { mic = window.__grant !== false; window.IrisNativeCb.onPerm(mic); }, 30); },
    startListening() { calls.push('startListening'); }, stopListening() { calls.push('stopListening'); }, cancelListening() { calls.push('cancelListening'); },
    speak(id, text, rate, vol) { calls.push('speak:' + id + ':' + rate); window.__lastTts = { id, text }; }, stopSpeaking() { calls.push('stopSpeaking'); },
    saveFile(name, text) { calls.push('saveFile:' + name); window.__saved = { name, text }; return 'Downloads/' + name; },
  };
  localStorage.setItem('nosso-sim-iris-v1', JSON.stringify({ prefs: { introDone: true, briefingOnOpen: false, speakOn: true }, consent: { voice: true, externalAI: false, level: 0 } }));
};
const srv = await startServer(ROOT); const browser = await launch(); const fix = JSON.stringify(fixtureV2());
const st = p => p.evaluate(() => document.querySelector('.iris-orb').getAttribute('data-state'));
const waitSt = (p, s) => p.waitForFunction(x => document.querySelector('.iris-orb')?.getAttribute('data-state') === x, s, { timeout: 5000 });
const cb = (p, fn, ...a) => p.evaluate(([f, args]) => window.IrisNativeCb[f](...args), [fn, a]);
try {
  const { context, page, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: BRIDGE, serviceWorkers: 'allow', url: srv.url + 'index.html?iris=1' });
  await sleep(300);
  check('"?iris=1" (atalho do app) abre a assistente', await page.locator('#iris-root').isVisible());
  check('sem Web Speech no WebView: a Íris usa o motor nativo (diz "Voz do Android")', await page.evaluate(async () => !window.SpeechRecognition && !window.webkitSpeechRecognition && Iris.app.session.caps().ptVoices[0].name.includes('Android')));
  await page.click('.iris-mic');
  await page.waitForFunction(() => window.__calls.includes('startListening')); await cb(page, 'onStt', 'start', '');
  await waitSt(page, 'listening');
  check('1ª vez: pede a permissão NATIVA do microfone e só então escuta', await page.evaluate(() => window.__calls.join('>').includes('requestMic>startListening')));
  await cb(page, 'onStt', 'partial', 'quantos dias');
  check('transcrição parcial nativa aparece', /quantos dias/.test(await page.locator('.iris-partial').innerText()));
  await cb(page, 'onStt', 'final', 'quantos dias faltam'); await cb(page, 'onStt', 'end', '');
  await page.waitForFunction(() => !!window.__lastTts);
  check('resposta da Íris pede ao Android para FALAR (TextToSpeech nativo)', /Faltam \d+ dias/.test(await page.evaluate(() => window.__lastTts.text)));
  await waitSt(page, 'speaking');
  // barge-in: tocar no mic durante a fala
  await page.evaluate(() => { window.__calls.length = 0; });
  await page.click('.iris-mic'); await page.waitForFunction(() => window.__calls.includes('startListening')); await cb(page, 'onStt', 'start', ''); await waitSt(page, 'listening');
  check('barge-in: tocar no mic manda parar a fala nativa e já escutar', await page.evaluate(() => window.__calls.includes('stopSpeaking') && window.__calls.includes('startListening')));
  await cb(page, 'onStt', 'error', 'no-speech'); await cb(page, 'onStt', 'end', '');
  await page.waitForSelector('.iris-msg--error');
  check('erro nativo "no-speech" vira mensagem acionável', /Não ouvi nada/.test(await page.locator('.iris-msg--error').last().innerText()));
  await cb(page, 'onStt', 'error', 'network');
  // fim da fala nativa volta a idle
  await page.evaluate(() => { window.__calls.length = 0; });
  await page.fill('#iris-input', 'quantos dias faltam'); await page.press('#iris-input', 'Enter');
  await page.waitForFunction(() => window.__calls.some(c => c.startsWith('speak:')));
  const id = await page.evaluate(() => window.__lastTts.id); await cb(page, 'onTts', id, 'start', ''); await cb(page, 'onTts', id, 'done', '');
  await waitSt(page, 'idle');
  check('quando o Android termina de falar, o orbe volta a "idle"', (await st(page)) === 'idle');
  // exportar backup pela ponte
  await page.click('.iris-icon-btn[aria-label="Fechar a conversa"]');
  await page.evaluate(() => document.querySelector('.top-actions [data-action="export"]') ? document.querySelector('.top-actions [data-action="export"]').click() : document.querySelector('[data-action="export"]').click());
  await sleep(200);
  const saved = await page.evaluate(() => window.__saved);
  check('"Salvar backup" usa a ponte nativa (Downloads) em vez de <a download>', saved && /^nosso-sim-backup-\d{4}-\d{2}-\d{2}\.json$/.test(saved.name) && JSON.parse(saved.text).budget.length === 2);
  check('não registra service worker dentro do APK (arquivos já são locais)', (await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)) === 0);
  check('sem erros de console e sem requests externos', log.errors.length === 0 && log.external.length === 0, [...log.errors, ...log.external].join('|'));
  await context.close();
  {   // permissão negada
    const c2 = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 }, init: { content: `window.__grant = false; (${BRIDGE})();` } });
    await c2.page.click('.iris-fab'); await sleep(200); await c2.page.click('.iris-mic'); await c2.page.waitForSelector('.iris-msg--error');
    check('permissão NEGADA: explica como liberar e NÃO inicia a escuta', /bloqueado/.test(await c2.page.locator('.iris-msg--error').last().innerText()) && !(await c2.page.evaluate(() => window.__calls.includes('startListening'))));
    await c2.context.close();
  }
  {   // fora do APK (sem ponte) nada muda
    const c3 = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 390, height: 844 } });
    check('fora do APK: sem ponte, o módulo nativo fica inativo', await c3.page.evaluate(() => !window.IrisAndroid && Iris.native.available() === false));
    await c3.context.close();
  }
} finally { await browser.close(); await srv.close(); }
const { failed } = R.summary(); process.exit(failed.length ? 1 : 0);
