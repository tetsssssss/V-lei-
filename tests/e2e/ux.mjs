// Fase 4: teclado/foco, configurações, modo conversa, memória, retenção, nome da assistente, movimento reduzido.
// Voz SIMULADA (stubs). Ver tests/roteiro_teste_telefone.md para o teste físico.
import path from 'node:path';
import { startServer, launch, makeReporter, openPage, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '.')); const R = makeReporter('UX / ACESSIBILIDADE / CONFIGURAÇÕES (voz SIMULADA)'); const { check } = R;
const FAKE = () => {
  window.__s = { rec: 0, spoken: [], mode: 'ok', text: 'quantos dias faltam', queue: [], rate: [], voice: [] };
  window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { window.__s.rec++; setTimeout(() => this.onstart && this.onstart(), 5); if (window.__s.mode === 'ok') setTimeout(() => { this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: window.__s.queue.length ? window.__s.queue.shift() : window.__s.text }], { isFinal: true })] }); setTimeout(() => this.onend && this.onend(), 5); }, 60); else setTimeout(() => { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); }, 60); } stop() { setTimeout(() => this.onend && this.onend(), 5); } abort() { setTimeout(() => this.onend && this.onend(), 5); } };
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  const V = [{ name: 'Microsoft Francisca Online (Natural)', lang: 'pt-BR', voiceURI: 'fr' }, { name: 'Daniel', lang: 'pt-BR', voiceURI: 'dn' }, { name: 'English', lang: 'en-US', voiceURI: 'en' }];
  Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => V, addEventListener() {}, removeEventListener() {}, cancel() {}, speak(u) { window.__s.spoken.push(u.text); window.__s.rate.push(u.rate); window.__s.voice.push(u.voice && u.voice.voiceURI); setTimeout(() => u.onend && u.onend(), 40); } }, configurable: true });
};
const pref = (o, c) => ({ content: `(${FAKE})();localStorage.setItem('nosso-sim-iris-v1', JSON.stringify({prefs:Object.assign({introDone:true,briefingOnOpen:false,speakOn:true},${JSON.stringify(o || {})}),consent:Object.assign({voice:true,externalAI:false,level:0},${JSON.stringify(c || {})})}))` });
const settle = p => p.waitForFunction(() => ['idle', 'error'].includes(document.querySelector('.iris-orb')?.getAttribute('data-state')), null, { timeout: 6000 }).then(() => sleep(60));
const say = async (p, t) => { await p.fill('#iris-input', t); await p.press('#iris-input', 'Enter'); await sleep(40); await settle(p); };
const srv = await startServer(ROOT); const browser = await launch(); const fix = JSON.stringify(fixtureV2());
const store = (p, k = 'nosso-sim-iris-v1') => p.evaluate(kk => JSON.parse(localStorage.getItem(kk) || 'null'), k);
try {
  // ---- teclado e foco ----
  {
    const { context, page, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref() });
    await page.focus('.iris-fab'); await page.keyboard.press('Enter'); await settle(page);
    check('abrir pelo teclado: foco vai para o microfone e o diálogo é modal', (await page.evaluate(() => document.activeElement.className)).includes('iris-mic') && (await page.getAttribute('#iris-root', 'aria-modal')) === 'true');
    const focusSeq = []; for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); focusSeq.push(await page.evaluate(() => !!document.activeElement.closest('#iris-root'))); }
    check('Tab fica preso dentro da tela de voz (sem escapar para o app)', focusSeq.every(Boolean));
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('#iris-root button, #iris-root input, #iris-root select')].filter(e => e.offsetParent && !(e.getAttribute('aria-label') || e.textContent.trim() || e.getAttribute('placeholder') || (e.id && document.querySelector(`label[for="${e.id}"]`)))).map(e => e.className));
    check('todo botão/campo visível tem nome acessível', unnamed.length === 0, unnamed.join(','));
    check('legendas são região "log" com aria-live', (await page.getAttribute('.iris-log', 'role')) === 'log' && (await page.getAttribute('.iris-log', 'aria-live')) === 'polite');
    await page.keyboard.press('Escape'); await sleep(100);
    check('Esc fecha e devolve o foco ao botão que abriu', !(await page.locator('#iris-root').isVisible()) && (await page.evaluate(() => document.activeElement.className)).includes('iris-fab'));
    check('sem erros de console', log.errors.length === 0 && log.console.length === 0, [...log.errors, ...log.console].join('|'));
    await context.close();
  }
  // ---- configurações: voz, velocidade, tema, nome ----
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref() });
    await page.click('.iris-fab'); await settle(page);
    await page.click('.iris-icon-btn[aria-label="Configurações da Íris"]'); await page.waitForSelector('#iris-voice');
    const opts = await page.$$eval('#iris-voice option', o => o.map(x => x.textContent));
    check('voz: só vozes pt-*, com "feminina provável" estimada pelo nome e aviso de que o gênero não é informado', opts.some(o => /Francisca.*feminina provável/.test(o)) && opts.every(o => !/English/.test(o)) && /não informa o gênero/.test(await page.locator('.iris-drawer:not([hidden])').innerText()));
    await page.selectOption('#iris-voice', 'dn'); await page.fill('#iris-rate', '0.8');
    await page.click('button:has-text("Ouvir amostra")'); await sleep(200);
    const sp = await page.evaluate(() => ({ rate: window.__s.rate.at(-1), voice: window.__s.voice.at(-1) }));
    check('prévia usa a voz e a velocidade escolhidas', sp.voice === 'dn' && Math.abs(sp.rate - 0.8) < 0.01, JSON.stringify(sp));
    await page.selectOption('#iris-theme', 'jarvis'); check('tema Jarvis pelas configurações', (await page.getAttribute('#iris-root', 'data-iris-theme')) === 'jarvis');
    await page.selectOption('#iris-motion', 'on');
    check('"reduzir animações" desliga as animações do orbe', (await page.evaluate(() => document.documentElement.getAttribute('data-iris-motion'))) === 'off' && (await page.evaluate(() => getComputedStyle(document.querySelector('.iris-orb__fibers')).animationName)) === 'none');
    await page.fill('#iris-name', 'Aurora'); await page.press('#iris-name', 'Tab');
    check('nome da assistente é configurável', (await page.locator('.iris-top h2').innerText()) === 'Aurora');
    await page.click('.iris-drawer:not([hidden]) .iris-icon-btn[aria-label="Voltar"]');
    await say(page, 'Aurora, quantos dias faltam?');
    check('o novo nome também funciona como chamado ("Aurora, …")', /Faltam \d+ dias/.test(await page.locator('.iris-msg--iris').last().innerText()));
    const s = await store(page); check('preferências persistem em chave própria', s.prefs.voiceURI === 'dn' && s.prefs.rate === 0.8 && s.prefs.theme === 'jarvis' && s.prefs.name === 'Aurora');
    await context.close();
  }
  // ---- modo conversa (opt-in): volta a ouvir; "obrigada" encerra; silêncio não faz laço ----
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref({ conversationMode: true }) });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(() => { window.__s.queue = ['quantos dias faltam', 'quantos dias faltam', 'obrigada']; });
    await page.click('.iris-mic'); await page.waitForFunction(() => window.__s.rec >= 2, null, { timeout: 6000 });
    check('modo conversa: depois de responder, volta a ouvir sozinho', true);
    await page.waitForFunction(() => window.__s.rec >= 3, null, { timeout: 6000 });
    check('…e continua ouvindo a próxima pergunta (2 respostas faladas até aqui)', true);
    await sleep(2500);
    check('"obrigada, Íris" encerra o modo conversa (não volta a ouvir)', (await page.evaluate(() => window.__s.rec)) === 3 && /De nada/.test(await page.locator('.iris-msg--iris').last().innerText()));
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref({ conversationMode: true }) });
    await page.click('.iris-fab'); await settle(page);
    await page.evaluate(() => { window.__s.mode = 'no-speech'; }); await page.click('.iris-mic'); await sleep(1800);
    const n = await page.evaluate(() => window.__s.rec);
    check('silêncio no modo conversa não gera laço de escuta', n === 1, `rec=${n}`);
    await context.close();
  }
  // ---- memória visível, ator, retenção ----
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref() });
    await page.click('.iris-fab'); await settle(page);
    await page.click('.iris-actor button:has-text("Gabriel")');
    await say(page, 'lembra que a Isabelle prefere flores brancas');
    await page.click('.iris-icon-btn[aria-label="Configurações da Íris"]'); await page.click('button:has-text("Ver o que a Íris lembra")');
    check('memória: a nota aparece com a ORIGEM e o autor', /flores brancas/.test(await page.locator('.iris-drawer:not([hidden])').last().innerText()) && /declarado por quem estava falando · Gabriel/.test(await page.locator('.iris-drawer:not([hidden])').last().innerText()));
    page.on('dialog', d => d.accept());
    await page.click('.iris-memory-item button:has-text("Apagar")');
    check('memória: dá para apagar uma nota', (await store(page)).memory.length === 0);
    await page.locator('.iris-drawer:not([hidden]) .iris-icon-btn[aria-label="Voltar"]').last().click(); await page.locator('.iris-drawer:not([hidden]) .iris-icon-btn[aria-label="Voltar"]').last().click();
    await say(page, 'quantos dias faltam');
    const a = (await store(page)).audit; check('ações ficam registradas na auditoria com o ator escolhido (Gabriel)', a.some(x => x.tool === 'rememberNote' && x.actor === 'Gabriel' && x.via === 'voz'), JSON.stringify(a.map(x => [x.tool, x.actor, x.via])));
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref({ retentionDays: 0 }) });
    await page.click('.iris-fab'); await settle(page); await say(page, 'quantos dias faltam');
    await page.reload(); await page.waitForSelector('#content');
    check('retenção "não guardar": a conversa NÃO é gravada no aparelho', ((await store(page)).conversation || []).length === 0);
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref() });
    await page.click('.iris-fab'); await settle(page); await say(page, 'quantos dias faltam');
    page.on('dialog', d => d.accept());
    await page.click('.iris-icon-btn[aria-label="Configurações da Íris"]'); await page.waitForSelector('button:has-text("Apagar histórico")'); await page.click('button:has-text("Apagar histórico")');
    check('"Apagar histórico" limpa a conversa salva e a da tela', ((await store(page)).conversation || []).length === 0 && (await page.locator('.iris-msg').count()) === 0);
    await context.close();
  }
  // ---- privacidade: nenhum áudio guardado, nenhuma requisição ao usar só o modo local ----
  {
    const { context, page, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], permissions: ['microphone'], viewport: { width: 390, height: 844 }, init: pref() });
    await page.click('.iris-fab'); await settle(page); await page.click('.iris-mic'); await settle(page);
    const dump = await page.evaluate(async () => JSON.stringify({ l: Object.assign({}, localStorage), s: Object.assign({}, sessionStorage), dbs: (indexedDB.databases ? await indexedDB.databases() : []).map(d => d.name) }));
    check('nenhum áudio/blob guardado (localStorage, sessionStorage, IndexedDB sem bancos de áudio)', !/data:audio|blob:|audio\//.test(dump) && !/audio/i.test(JSON.parse(dump).dbs.join()));
    check('modo local: zero requests além da própria origem e nenhuma para /api', log.external.length === 0 && log.requests.every(u => !/\/api\//.test(u)));
    await context.close();
  }
} finally { await browser.close(); await srv.close(); }
const { failed } = R.summary(); process.exit(failed.length ? 1 : 0);
