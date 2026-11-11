// Testa o PACOTE PÚBLICO real (saída de build-packages --stage-only): CSP, PWA, offline, primeiro acesso, atalho.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, launch, makeReporter, openPage, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';
const ROOT = path.resolve(process.argv[2] || 'dist/_stage/frontend');
const R = makeReporter(`PACOTE PÚBLICO (${path.basename(path.dirname(ROOT))}/${path.basename(ROOT)})`); const { check } = R;
const CSPWATCH = () => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || ''))); };
const srv = await startServer(ROOT); const browser = await launch();
try {
  {
    const { context, page, log } = await openPage(browser, srv.url, { viewport: { width: 390, height: 844 }, init: CSPWATCH, serviceWorkers: 'allow' });
    const html = await page.content();
    check('CSP por <meta> com hash do script inline (sem unsafe-inline em scripts)', /Content-Security-Policy/.test(html) && /script-src 'self' 'sha256-/.test(html) && !/script-src[^;]*unsafe-inline/.test(html));
    check('abre vazio: o pacote público não traz dados pessoais', (await page.evaluate(() => window.NS_SEED === null && Iris.app.ns.getData().guests.length === 0 && Iris.app.ns.getData().couples.length === 0)));
    check('aviso de "Primeiro acesso" com botão de importar backup', /Primeiro acesso neste aparelho/.test(await page.locator('#content').innerText()));
    check('sem erros de console e sem violações de CSP ao abrir', log.errors.length === 0 && log.console.filter(c => !/404/.test(c)).length === 0 && (await page.evaluate(() => window.__csp.length)) === 0, [...log.errors, ...log.console].join('|'));
    check('CSP efetiva: um script injetado é BLOQUEADO', await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__pwn = 1'; document.head.append(s); return window.__pwn === undefined; }) && (await page.evaluate(() => window.__csp.some(v => /script-src/.test(v)))));
    // importar backup (fluxo de primeiro acesso) e usar a Íris sob a CSP
    const tmp = path.join(os.tmpdir(), 'backup-teste.json'); fs.writeFileSync(tmp, JSON.stringify(fixtureV2()));
    page.on('dialog', d => d.accept()); await page.setInputFiles('#import-json', tmp); await sleep(400);
    check('importar o backup traz os dados para o aparelho', (await page.evaluate(() => Iris.app.ns.getData().guests.length)) === 3);
    await page.click('.iris-fab'); await page.fill('#iris-input', 'quantos dias faltam'); await page.press('#iris-input', 'Enter'); await sleep(500);
    check('Íris responde sob a CSP (motor local)', /Faltam \d+ dias/.test(await page.locator('.iris-msg--iris').last().innerText()));
    await page.click('.iris-icon-btn[aria-label="Fechar a conversa"]');
    await page.evaluate(() => Iris.app.ns.navigate('central')); await sleep(400);
    check('Central de comando renderiza sob a CSP (SVG/estilos)', (await page.locator('.iris-central [data-panel]').count()) >= 8);
    // foto local (blob:) permitida por img-src
    await page.evaluate(() => Iris.app.ns.navigate('padrinhos')); await sleep(200);
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 80; c.height = 100; const x = c.getContext('2d'); x.fillStyle = '#a66'; x.fillRect(0, 0, 80, 100); return c.toDataURL('image/png').split(',')[1]; });
    const tmpImg = path.join(os.tmpdir(), 'foto-teste.png'); fs.writeFileSync(tmpImg, Buffer.from(png, 'base64'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#content [data-pf="add"] >> nth=0')]); await fc.setFiles(tmpImg);
    await page.waitForFunction(() => { const i = document.querySelector('#content .pf img.pf-img'); return i && i.naturalWidth > 0; }, null, { timeout: 8000 });
    check('foto local (blob:) funciona sob a CSP', await page.evaluate(() => { const i = document.querySelector('#content .pf img.pf-img'); return i.src.startsWith('blob:') && i.naturalWidth > 0; }));
    check('nenhuma violação de CSP durante os fluxos principais', (await page.evaluate(() => window.__csp.filter(v => !/script-src/.test(v)).length)) === 0, (await page.evaluate(() => window.__csp.join(' | '))));
    check('zero requests externos', log.external.length === 0, log.external.join(','));
    await context.close();
  }
  {   // PWA: instala sem as fotos privadas, funciona offline, atalho abre a Íris
    const { context, page } = await openPage(browser, srv.url, { viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
    await page.evaluate(() => navigator.serviceWorker.ready); await sleep(800);
    const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { keys, urls: (await c.keys()).map(r => new URL(r.url).pathname) }; });
    check('service worker instalou (cache v3) mesmo sem fotos opcionais', cached.keys.includes('nosso-sim-v3-1') && cached.urls.includes('/index.html') && cached.urls.includes('/iris/boot.js') && cached.urls.includes('/v31/boot.js') && cached.urls.includes('/v31/ui/planta.js') && cached.urls.includes('/v31/v31.css') && !cached.urls.some(u => /assets\/casal/.test(u)), JSON.stringify(cached.keys));
    await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await sleep(500); // passa a ser controlado pelo SW
    await context.setOffline(true); await page.reload(); await page.waitForSelector('#content', { timeout: 8000 });
    check('OFFLINE: o app abre pelo cache e a Íris responde por texto', await page.evaluate(() => !!window.Iris && !!document.querySelector('.iris-fab')));
    await page.click('.iris-fab'); await page.fill('#iris-input', 'quantos dias faltam'); await page.press('#iris-input', 'Enter'); await sleep(500);
    check('OFFLINE: comando local funciona sem rede', /Faltam \d+ dias/.test(await page.locator('.iris-msg--iris').last().innerText()));
    check('OFFLINE: telas V3.1 (planta, convites, cerimonialista) abrem pelo cache', await (async () => { await page.evaluate(() => window.V31 && 1); await page.keyboard.press('Escape').catch(() => {}); const ok = await page.evaluate(async () => { const ns = window.NossoSim; const out = []; for (const k of ['planta', 'rsvp', 'cerimonialista']) { ns.navigate(k); await new Promise(r => setTimeout(r, 300)); out.push((document.getElementById('v31-' + k) || {}).textContent.length > 50); } return out.every(Boolean) && window.V31.version === '3.1'; }); return ok; })());
    await context.setOffline(false); await context.close();
    const m = await (await fetch(srv.url + 'manifest.webmanifest')).json();
    check('manifest servido com atalho para a Íris', m.shortcuts && /iris=1/.test(m.shortcuts[0].url));
    const c2 = await openPage(browser, srv.url, { viewport: { width: 390, height: 844 }, url: srv.url + 'index.html?iris=1', init: CSPWATCH });
    check('atalho "?iris=1" abre a assistente direto', await c2.page.locator('#iris-root').isVisible());
    await c2.context.close();
  }
} finally { await browser.close(); await srv.close(); }
const { failed } = R.summary(); process.exit(failed.length ? 1 : 0);
