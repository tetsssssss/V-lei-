// Fotos dos padrinhos. Parte A: dados e imagem FICTÍCIOS (importar, enquadrar, trocar, remover, privacidade).
// Parte B (--private): confere o seed PRIVADO local usando só contagens/status — não cita nomes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, launch, makeReporter, openPage, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '.'));
const PRIVATE = process.argv.includes('--private');
const R = makeReporter(`FOTOS DOS PADRINHOS ${PRIVATE ? '(seed privado)' : '(dados fictícios)'}`);
const { check } = R;
const FAKE_SPEECH = () => { window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } }; Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {}, speak(u) { setTimeout(() => u.onend && u.onend(), 20); } }, configurable: true }); };
const srv = await startServer(ROOT); const browser = await launch();
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), STORAGE_KEY);
const gotoPad = page => page.evaluate(() => { const d = document.querySelector('#desktop-nav [data-section="padrinhos"]'); if (d && d.offsetParent) d.click(); else { document.querySelector('[data-action="more"]').click(); document.querySelector('#modal-root [data-section="padrinhos"]').click(); } });
const type = async (page, t) => { await page.fill('#iris-input', t); await page.press('#iris-input', 'Enter'); await page.waitForFunction(() => ['idle', 'error'].includes(document.querySelector('.iris-orb')?.getAttribute('data-state'))); await sleep(80); };

try {
  if (!PRIVATE) {
    const { context, page, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, JSON.stringify(fixtureV2())], viewport: { width: 390, height: 844 }, init: FAKE_SPEECH });
    // imagem fictícia 400×800 com faixas pretas (como captura de tela): gerada no navegador
    const dataUrl = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 400, 800); const g = x.createLinearGradient(0, 80, 400, 720); g.addColorStop(0, '#d98c6a'); g.addColorStop(1, '#6a8cd9'); x.fillStyle = g; x.fillRect(0, 80, 400, 640); return c.toDataURL('image/png'); });
    const tmp = path.join(os.tmpdir(), 'iris-teste-foto.png'); fs.writeFileSync(tmp, Buffer.from(dataUrl.split(',')[1], 'base64'));
    await gotoPad(page);
    check('sem foto: cada par tem botão "＋ Foto"', (await page.locator('#content [data-pf="add"]').count()) === 2);
    await page.setInputFiles('input[type=file]', []).catch(() => {});
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#content .item[data-couple-id="pair-t1"] [data-pf="add"]')]);
    await chooser.setFiles(tmp);
    await page.waitForSelector('#content .item[data-couple-id="pair-t1"] .pf img.pf-img');
    let s = await stored(page); const link = s.padrinhoFotos[0];
    check('importar vincula ao par (não mescla nem renomeia ninguém)', s.padrinhoFotos.length === 1 && link.coupleId === 'pair-t1' && s.couples.length === 3 && s.couples.find(c => c.id === 'pair-t1').name === 'Fulano Teste & Fulana Teste');
    check('foto guardada só como referência local (bytes NÃO vão para o JSON do app)', link.src.startsWith('local:') && !JSON.stringify(s).includes('data:image') && JSON.stringify(s).length < 6000);
    await page.waitForFunction(() => { const i = document.querySelector('#content .pf img.pf-img'); return i && i.naturalWidth > 0; });
    const dims = await page.evaluate(() => { const i = document.querySelector('#content .pf img.pf-img'); return { w: i.naturalWidth, h: i.naturalHeight }; });
    check('faixas escuras de captura de tela foram recortadas', dims.w === 400 && dims.h > 600 && dims.h < 700, JSON.stringify(dims));
    await page.reload(); await page.waitForSelector('#content'); await gotoPad(page);
    await page.waitForFunction(() => { const i = document.querySelector('#content .pf img.pf-img'); return i && i.naturalWidth > 0; });
    check('foto continua após recarregar (IndexedDB)', true);
    // enquadrar
    await page.click('#content .pf .pf-actions button:has-text("Enquadrar")');
    await page.fill('#pf-zoom', '1.5'); await page.fill('#pf-x', '30'); await page.fill('#pf-y', '60');
    await page.click('.dialog button:has-text("Salvar enquadramento")');
    s = await stored(page);
    check('enquadramento salvo (zoom/posição) sem alterar a imagem', s.padrinhoFotos[0].crop.zoom === 1.5 && s.padrinhoFotos[0].crop.x === 30 && s.padrinhoFotos[0].crop.y === 60);
    // abrir ampliada + foto em foco + Íris recusa biometria
    await page.click('#content .pf .pf-open');
    check('foto ampliada traz o aviso de que a Íris não identifica rostos', /não identifica pessoas pelo rosto/.test(await page.locator('.dialog').innerText()));
    await page.click('.dialog [data-action="close"]');
    await page.click('.iris-fab'); await page.waitForFunction(() => !!document.querySelector('.iris-orb'));
    await type(page, 'Íris, quem é a pessoa da foto?');
    const t = await page.locator('.iris-msg--iris').last().innerText();
    check('"quem é a pessoa da foto?" → recusa e lê só a legenda atribuída', /Eu não identifico pessoas pelo rosto/.test(t) && /Fulano Teste & Fulana Teste/.test(t), t);
    await type(page, 'mostra as fotos dos padrinhos');
    check('"mostra as fotos" abre Padrinhos em modo espiar e destaca as fotos', (await page.getAttribute('#iris-root', 'data-mode')) === 'peek' && (await page.locator('#content .pf').count()) === 1);
    // backup JSON não leva a imagem
    const exp = await page.evaluate(() => JSON.stringify(Iris.app.ns.getData()));
    check('backup JSON leva vínculo/enquadramento e NUNCA os bytes da foto', /"padrinhoFotos"/.test(exp) && !/data:image|\/9j\//.test(exp));
    // remover
    await page.click('.iris-icon-btn[aria-label="Fechar a conversa"]');
    page.on('dialog', d => d.accept());
    await page.click('#content .pf .pf-actions button:has-text("Remover")');
    s = await stored(page);
    const keyLeft = await page.evaluate(async () => { try { const db = await new Promise((r, j) => { const q = indexedDB.open('nosso-sim-fotos', 1); q.onsuccess = () => r(q.result); q.onerror = j; }); return await new Promise(r => { const q = db.transaction('fotos').objectStore('fotos').count(); q.onsuccess = () => r(q.result); }); } catch (e) { return -1; } });
    check('remover apaga o vínculo E a cópia local da foto; o par continua', s.padrinhoFotos.length === 0 && s.couples.length === 3 && keyLeft === 0, `fotos no IDB=${keyLeft}`);
    check('zero requests externos / sem erros', log.external.length === 0 && log.errors.length === 0, [...log.external, ...log.errors].join(' | '));
    await context.close();
  } else {
    const { context, page, log } = await openPage(browser, srv.url, { viewport: { width: 1440, height: 900 }, init: FAKE_SPEECH });
    await gotoPad(page);
    await page.waitForFunction(() => document.querySelectorAll('#content .pf img.pf-img').length >= 5);
    await page.waitForFunction(() => [...document.querySelectorAll('#content .pf img.pf-img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    const s = await stored(page).catch(() => null);
    const d = await page.evaluate(() => { const x = Iris.app.ns.getData(); return { pairs: x.couples.filter(c => c.role !== 'Entrada').length, entries: x.couples.filter(c => c.role === 'Entrada').length, links: (x.padrinhoFotos || []).map(p => p.status), guests: x.guests.length, people: x.guests.reduce((n, g) => n + Math.max(1, g.qty), 0), adults: x.guests.reduce((n, g) => n + (g.adults || 0), 0), children: x.guests.reduce((n, g) => n + (g.children || 0), 0), eq: (x.nameEquivalences || []).length, notes: (x.sourceNotes || []).length, confirmed: x.guests.filter(g => g.attendance === 'Confirmado').length }; });
    check('12 pares de padrinhos + 2 entradas preservados (criança nas fotos não vira padrinho)', d.pairs === 12 && d.entries === 2, JSON.stringify(d));
    check('5 fotos vinculadas: 2 de nomes idênticos e 3 sugeridas para revisão', d.links.length === 5 && d.links.filter(x => x === 'exato').length === 2 && d.links.filter(x => x === 'sugerido').length === 3, d.links.join(','));
    check('as 5 imagens do pacote privado carregam no app', (await page.locator('#content .pf img.pf-img').count()) === 5);
    check('painel "para revisar" mostra as 3 sugestões e as equivalências', (await page.locator('.pf-review [data-pf-review]').count()) === 3 && d.eq >= 4);
    check('convidados preservados: 44 convites, 102 pessoas (83 adultos + 19 crianças), 0 confirmados', d.guests === 44 && d.people === 102 && d.adults === 83 && d.children === 19 && d.confirmed === 0, JSON.stringify(d));
    check('aviso de fontes divergentes presente', d.notes === 1);
    check('imagens só de origem própria; nenhum request externo', log.external.length === 0 && log.requests.filter(u => /assets\/padrinhos\//.test(u)).every(u => u.startsWith(srv.url)), log.external.join(','));
    await page.click('.iris-fab'); await page.waitForFunction(() => !!document.querySelector('.iris-orb'));
    await type(page, 'Íris, mostra as fotos dos padrinhos');
    check('"mostra as fotos": spotlight nas 5 fotos reais', (await page.locator('#content .pf').count()) === 5 && /fotos vinculadas/.test(await page.locator('.iris-msg--iris').last().innerText()));
    await page.screenshot({ path: process.env.SHOT || path.join(os.tmpdir(), 'padrinhos-privado.png') });
    await context.close();
  }
} finally { await browser.close(); await srv.close(); }
const { failed } = R.summary(); process.exit(failed.length ? 1 : 0);
