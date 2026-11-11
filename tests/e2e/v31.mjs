// V3.1 e2e: convites/WhatsApp, parcelas, cronograma, planta (calibração, arrastar, zonas, 3D dia/noite), Cerimonialista, exportações, pacote ZIP.
// Dados 100% FICTÍCIOS. Print = PNG sintético. WhatsApp NÃO é aberto de verdade (rota bloqueada): só confere o link gerado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer, launch, makeReporter, openPage, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';
import { fakeSatellitePng } from './png.mjs';
const require = createRequire(import.meta.url);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '.')), SHOTS = arg('--shots', '');
for (const f of ['data', 'zip']) require(path.join(ROOT, `v31/core/${f}.js`));
const Z = globalThis.V31.zip;
const R = makeReporter('V3.1 (convites, parcelas, cronograma, planta, cerimonialista, pacote)'); const { check } = R;
const srv = await startServer(ROOT), browser = await launch();
const png = fakeSatellitePng(); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v31e2e-')); const pngFile = path.join(tmp, 'print-ficticio.png'); fs.writeFileSync(pngFile, png);
const fix = () => { const d = fixtureV2(); d.settings.date = '2027-11-13'; return JSON.stringify(d); };
const shot = async (p, n) => { if (!SHOTS) return; await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const go = async (p, k) => { await p.evaluate(k => window.NossoSim.navigate(k), k); await sleep(250); };
const data = p => p.evaluate(() => JSON.parse(JSON.stringify(window.NossoSim.getData())));
const stored = (p) => p.evaluate(k => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
const lum = (p, kind) => p.evaluate(async kind => { const b = await window.V31.planta.snapshotPng(kind); const bmp = await createImageBitmap(b); const c = document.createElement('canvas'); c.width = 200; c.height = Math.round(200 * bmp.height / bmp.width); const x = c.getContext('2d'); x.drawImage(bmp, 0, 0, c.width, c.height); const px = x.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < px.length; i += 4) s += .299 * px[i] + .587 * px[i + 1] + .114 * px[i + 2]; return s / (px.length / 4); }, kind);
const hscroll = p => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const dl = async (p, clickFn) => { const [d] = await Promise.all([p.waitForEvent('download'), clickFn()]); const f = path.join(tmp, 'dl-' + Math.random().toString(36).slice(2) + '-' + d.suggestedFilename()); await d.saveAs(f); return { name: d.suggestedFilename(), buf: fs.readFileSync(f), file: f }; };
try {
  // ===================== PLANTA =====================
  const { context, page: p, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix()], viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await p.waitForFunction(() => window.V31 && window.V31.version === '3.1');
  check('abre com 6 seções novas no menu', await p.evaluate(() => ['rsvp', 'parcelas', 'planta', 'dia', 'cerimonialista', 'pacote'].every(k => window.NossoSim.catalogs.nav().some(x => x[0] === k))));
  check('o bloco data.v31 nasce vazio e não altera os dados antigos', await p.evaluate(() => { const d = window.NossoSim.getData(); return d.v31 && d.v31.plan.objects.length === 0 && d.guests.length === 3 && d.budget.length === 2; }));
  await go(p, 'planta');
  check('sem print: mostra opções de criar (print ou área em metros), nenhuma medida pré-definida', (await p.textContent('#v31-planta')).includes('Escolher o print') && (await data(p)).v31.plan.base === null);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=Escolher o print')]); await fc.setFiles(pngFile); await sleep(700);
  let d = await data(p);
  check('print importado: tamanho em pixels registrado, escala AINDA nula', d.v31.plan.base.kind === 'image' && d.v31.plan.base.wPx === 1600 && d.v31.plan.base.hPx === 1000 && d.v31.plan.base.pxPerM === null, JSON.stringify(d.v31.plan.base));
  check('print guardado no IndexedDB (não no JSON/localStorage)', await p.evaluate(async () => { const r = await window.V31.kit.files.get(window.NossoSim.getData().v31.plan.base.key); return !!r && r.blob.size > 1000; }) && !JSON.stringify(await stored(p)).includes('base64'));
  check('sem escala não deixa adicionar mesa (regra: não inventar medida)', await p.evaluate(() => { try { window.V31.plan.addItem(window.NossoSim.getData(), 'mesa-redonda'); return false; } catch (e) { return /Defina a planta/.test(e.message); } }));
  // calibrar: dois cliques separados por 50% da largura do print (800 px) = 80 m reais ⇒ 10 px/m
  const box = await p.locator('#v31-planta svg.v31-svg').boundingBox();
  const y0 = box.y + box.height * .5; await p.mouse.click(box.x + box.width * .10, y0); await p.mouse.click(box.x + box.width * .60, y0); await sleep(150);
  check('calibração: marcou 2 pontos e pede a distância real', (await p.locator('#v31-planta input[aria-label="Distância real em metros"]').count()) === 1 && await p.locator('text=Aplicar escala').isEnabled());
  await p.fill('#v31-planta input[aria-label="Distância real em metros"]', '80'); await p.click('text=Aplicar escala'); await sleep(300);
  d = await data(p); const ppm = d.v31.plan.base.pxPerM;
  check('escala calibrada ≈ 10 px/m (±2% por arredondamento do clique)', Math.abs(ppm - 10) < .2, String(ppm));
  check('área da planta calculada em metros (≈160 × 100 m)', await p.evaluate(() => { const s = window.V31.geo.baseSize(window.NossoSim.getData().v31.plan.base); return Math.abs(s.w - 160) < 3.5 && Math.abs(s.h - 100) < 2.2; }));
  // mesa
  await p.click('text=+ Mesa redonda'); await sleep(200); d = await data(p); let t = d.v31.plan.objects[0];
  check('mesa redonda criada com tamanho SUGERIDO (rotulado), 8 lugares', t && t.type === 'mesa-redonda' && t.w === 1.6 && t.seats === 8 && t.suggested === true && (await p.textContent('#v31-planta')).includes('Tamanho sugerido'));
  // arrastar com o mouse
  const g = p.locator('#v31-planta g[data-id]').first(); const gb = await g.boundingBox(); const zoom = await p.evaluate(() => { const s = document.querySelector('#v31-planta svg.v31-svg'); return s.getBoundingClientRect().width / window.V31.geo.baseSize(window.NossoSim.getData().v31.plan.base).w; });
  const x0 = t.x, y0m = t.y; await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await p.mouse.down(); await p.mouse.move(gb.x + gb.width / 2 + 5 * zoom, gb.y + gb.height / 2 + 5 * zoom, { steps: 8 }); await p.mouse.up(); await sleep(200);
  d = await data(p); t = d.v31.plan.objects[0];
  check('arrastar com o mouse move a mesa ≈ 5 m para cada lado (e persiste)', Math.abs(t.x - x0 - 5) < .6 && Math.abs(t.y - y0m - 5) < .6, `${t.x - x0},${t.y - y0m}`);
  check('persistiu no localStorage', (await stored(p)).v31.plan.objects[0].x === t.x);
  // inspector numérico
  await p.fill('#v31-planta [data-k="w"]', '2'); await p.press('#v31-planta [data-k="w"]', 'Tab'); await sleep(200); d = await data(p);
  check('editar diâmetro no painel muda o objeto e remove o selo "sugerido"', d.v31.plan.objects[0].w === 2 && d.v31.plan.objects[0].suggested === false);
  // 2ª mesa colada → Cerimonialista acusa sobreposição
  await p.click('text=+ Mesa redonda'); await sleep(150); d = await data(p); const o2 = d.v31.plan.objects[1];
  await p.evaluate(([id, x, y]) => { const dd = window.NossoSim.getData(); window.V31.plan.update(dd, id, { x, y }); window.NossoSim.save(); }, [o2.id, d.v31.plan.objects[0].x + 1, d.v31.plan.objects[0].y]);
  const ids = await p.evaluate(() => window.V31.ceri.check(window.NossoSim.getData()).findings.map(f => f.id));
  check('Cerimonialista acusa mesas sobrepostas', ids.some(i => i.startsWith('sobrep-')), ids.join(','));
  await p.evaluate(([id]) => { const dd = window.NossoSim.getData(); window.V31.plan.update(dd, id, { x: dd.v31.plan.objects[0].x + 6, y: dd.v31.plan.objects[0].y }); window.NossoSim.save(); }, [o2.id]); await go(p, 'planta');
  // zona desenhada
  await p.click('text=▭ Pista de dança'); await sleep(100);
  const sb = await p.locator('#v31-planta svg.v31-svg').boundingBox(); const zoomN = sb.width / 160;
  await p.mouse.move(sb.x + 60 * zoomN, sb.y + 60 * zoomN); await p.mouse.down(); await p.mouse.move(sb.x + 70 * zoomN, sb.y + 68 * zoomN, { steps: 6 }); await p.mouse.up(); await sleep(250);
  d = await data(p); const zone = d.v31.plan.objects.find(o => o.kind === 'zona');
  check('pista desenhada ≈ 10 × 8 m a partir do arrasto (medida vem do usuário)', zone && Math.abs(zone.w - 10) < .8 && Math.abs(zone.h - 8) < .8, zone && `${zone.w}x${zone.h}`);
  // mesa de frios + convites
  await p.click('text=+ Mesa de frios'); await sleep(150); d = await data(p);
  check('mesa de frios existe, sem lugares', d.v31.plan.objects.some(o => o.type === 'mesa-frios' && o.seats === 0));
  await p.click('text=Distribuir convites nas mesas'); await sleep(250); d = await data(p);
  check('distribuir convites: todos os 3 convites ganham mesa (2 mesas × 8 lugares)', Object.values(d.v31.guestMeta).filter(m => m.table).length === 3, JSON.stringify(d.v31.guestMeta));
  await p.evaluate(() => { const dd = window.NossoSim.getData(); }); await shot(p, 'planta-2d');
  // 3D dia/noite
  await p.click('text=Vista 3D'); await sleep(300);
  check('vista 3D renderiza com polígonos (mesas extrudadas) e ao menos uma imagem de chão', await p.evaluate(() => { const s = document.querySelector('#v31-planta svg.v31-iso'); return !!s && s.querySelectorAll('polygon').length > 12 && s.querySelectorAll('image').length === 1; }));
  await p.click('text=☀ Dia'); await sleep(200); const lDay = await lum(p, 'iso'); await shot(p, 'planta-3d-dia');
  await p.click('text=☾ Noite'); await sleep(200); const lNight = await lum(p, 'iso'); await shot(p, 'planta-3d-noite');
  check('noite é visivelmente mais escura que o dia (luminância média medida no PNG)', lNight < lDay * 0.75, `dia=${lDay.toFixed(1)} noite=${lNight.toFixed(1)}`);
  check('rótulo acessível da vista muda (dia/noite)', (await p.getAttribute('#v31-planta svg.v31-iso', 'aria-label')).includes('noite'));
  const sunTxt = await p.textContent('#v31-planta .v31-toolbar'); check('mostra pôr do sol estimado (≈18:3x) ', /Pôr do sol estimado: 18:[23]\d/.test(sunTxt), sunTxt.slice(-80));
  await p.click('text=↻ Girar'); await sleep(150); check('girar a vista 90° re-renderiza sem erro', await p.evaluate(() => !!document.querySelector('#v31-planta svg.v31-iso')));
  const pngBlob = await p.evaluate(async () => { const b = await window.V31.planta.snapshotPng('plan'); return { size: b.size, type: b.type }; }); check('exporta PNG da planta (tipo e tamanho)', pngBlob.type === 'image/png' && pngBlob.size > 5000, JSON.stringify(pngBlob));
  check('sem erros de console/página na planta', log.errors.length === 0 && log.console.filter(c => !/404/.test(c)).length === 0, [...log.errors, ...log.console].join(' | '));

  // ===================== CONVITES / WHATSAPP =====================
  await go(p, 'rsvp');
  check('lista os 3 convites e mostra a prévia da mensagem com data e casal', (await p.locator('#v31-rsvp .v31-row-card').count()) === 3 && /Gabriel e Isabelle/.test(await p.textContent('#v31-rsvp .v31-preview')) && /13\/11\/2027/.test(await p.textContent('#v31-rsvp .v31-preview')));
  const first = p.locator('#v31-rsvp .v31-row-card').first();
  check('sem telefone: botão do WhatsApp desativado (não monta link)', (await first.locator('a.v31-btn.primary').getAttribute('aria-disabled')) === 'true');
  await first.locator('input[type=tel]').fill('(14) 99999-1234'); await first.locator('input[type=tel]').press('Tab'); await sleep(250);
  const a = p.locator('#v31-rsvp .v31-row-card').first().locator('a.v31-btn.primary'); const href = await a.getAttribute('href');
  check('com telefone: link wa.me com DDI 55 e texto codificado', /^https:\/\/wa\.me\/5514999991234\?text=Oi%2C%20/.test(href), href);
  await context.route('https://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' })); // nunca abre o WhatsApp de verdade
  const [pop] = await Promise.all([context.waitForEvent('page'), a.click()]); await sleep(300); await pop.close();
  d = await data(p); const gid = d.guests[0].id;
  check('abrir o WhatsApp marca "enviado" (e só isso: presença continua Pendente)', !!d.v31.guestMeta[gid].sentAt && d.guests[0].attendance === 'Pendente');
  const s2 = p.locator('#v31-rsvp .v31-row-card').first(); await s2.locator('text=Vai').first().click(); await s2.locator('input[aria-label="Adultos"]').fill('2'); await s2.locator('input[aria-label="Crianças"]').fill('1'); await s2.locator('text=Registrar: vai').click(); await sleep(250);
  d = await data(p); check('registrar resposta "vai" atualiza adultos/crianças/presença', d.guests[0].attendance === 'Confirmado' && d.guests[0].qty === 3 && d.guests[0].children === 1 && d.v31.guestMeta[gid].reply.status === 'vai' || d.v31.guestMeta[gid].reply.status === 'sim');
  await p.reload(); await p.waitForFunction(() => window.V31 && window.V31.version === '3.1'); d = await data(p);
  check('persiste após recarregar (telefone, envio, resposta)', d.v31.guestMeta[gid].phone === '(14) 99999-1234' && d.v31.guestMeta[gid].sentAt && d.guests[0].attendance === 'Confirmado');
  check('planta também persiste após recarregar (print no IndexedDB + escala)', await p.evaluate(async () => { const b = window.NossoSim.getData().v31.plan.base; const r = await window.V31.kit.files.get(b.key); return !!r && b.pxPerM > 9; }));

  // ===================== PARCELAS =====================
  await go(p, 'parcelas');
  await p.selectOption('#v31-parcelas select', 'b-foto'); await p.fill('#v31-parcelas input[aria-label="Valor a parcelar"]', '1000'); await p.fill('#v31-parcelas input[aria-label="Número de parcelas"]', '3'); await p.fill('#v31-parcelas input[aria-label="Primeiro vencimento"]', '2026-11-01'); await p.click('text=Gerar parcelas'); await sleep(300);
  d = await data(p); check('parcelar 1000 em 3 = 333,33 + 333,33 + 333,34 (centavos exatos)', JSON.stringify(d.v31.installments.map(x => x.amount)) === JSON.stringify([333.33, 333.33, 333.34]));
  check('mostra parcela vencida (01/11/2026 está antes de "hoje") e a soma ≠ estimado do item', /Vencida/.test(await p.textContent('#v31-parcelas')) && /parcelas somam/.test(await p.textContent('#v31-parcelas')));
  await p.locator('#v31-parcelas .v31-trow', { hasText: '1/3' }).locator('text=Marcar como paga').click(); await sleep(250); d = await data(p);
  check('marcar paga soma ao "pago" do item (500 + 333,33)', d.budget[0].paid === 833.33, String(d.budget[0].paid));
  await p.locator('#v31-parcelas .v31-trow', { hasText: '1/3' }).locator('text=Desfazer pago').click(); await sleep(250); d = await data(p); check('desfazer devolve (500)', d.budget[0].paid === 500);

  // ===================== CRONOGRAMA =====================
  await go(p, 'dia');
  await p.fill('#v31-dia input[aria-label="Horário da cerimônia"]', '16:30'); await p.click('text=Gerar modelo sugerido'); await sleep(300); d = await data(p);
  check('modelo sugerido: 11 momentos, "Cerimônia" às 16:30', d.v31.dayPlan.length === 11 && d.v31.dayPlan.find(x => x.title === 'Cerimônia').start === '16:30');
  await p.fill('#v31-dia input[aria-label="Início"]', '16:45'); await p.fill('#v31-dia input[aria-label="Duração em minutos"]', '30'); await p.fill('#v31-dia input[aria-label="Momento"]', 'Conflito de teste'); await p.selectOption('#v31-dia select', { label: d.v31.plan.objects[0].label }); await p.click('#v31-dia button[type=submit]'); await sleep(300);
  check('conflito de horário aparece marcado na linha do tempo', (await p.locator('#v31-dia .v31-trow.conflict').count()) >= 2);
  check('momento aponta para um objeto da planta', (await data(p)).v31.dayPlan.some(x => x.title === 'Conflito de teste' && x.where));
  check('mostra pôr do sol estimado do dia', /18:3\d/.test(await p.textContent('#v31-dia')));
  await shot(p, 'dia');

  // ===================== CERIMONIALISTA + EXPORTAÇÕES =====================
  await go(p, 'cerimonialista');
  const txt = await p.textContent('#v31-cerimonialista');
  check('Cerimonialista lista achados com níveis (conflito de cronograma, parcelas)', /Problema/.test(txt) && /invade/.test(txt) && /parcela\(s\) vencida/.test(txt));
  check('botão "Ir para" leva à seção certa', await (async () => { await p.locator('#v31-cerimonialista .v31-find', { hasText: 'invade' }).locator('button').first().click(); await sleep(250); return (await p.evaluate(() => window.NossoSim.getSection())) === 'dia'; })());
  await go(p, 'cerimonialista');
  check('IA desligada por padrão: botão de redigir desativado e texto vem das regras', await p.locator('text=Redigir mensagem para a cerimonialista (IA)').isDisabled() && /Conferi o plano/.test(await p.textContent('#v31-cerimonialista .v31-pre')));
  const csvG = await dl(p, () => p.click('text=Convidados (CSV)'));
  const g1 = csvG.buf.toString('utf8'); check('CSV de convidados: BOM, ";" e SEM telefone por padrão', g1.charCodeAt(0) === 0xfeff && g1.includes('Convite;Grupo') && !g1.includes('99999-1234'));
  await p.check('input[aria-label="Incluir telefones"]'); const csvG2 = await dl(p, () => p.click('text=Convidados (CSV)'));
  check('com a caixa marcada o CSV inclui o telefone', csvG2.buf.toString('utf8').includes('(14) 99999-1234'));
  await p.uncheck('input[aria-label="Incluir telefones"]');
  const htm = await dl(p, () => p.click('text=Dossiê imprimível (HTML)')); const hs = htm.buf.toString('utf8');
  fs.writeFileSync(path.join(tmp,'dossie-debug.html'), hs); console.log('   [dossiê] cronograma:',hs.includes('Cronograma do dia'),'svg:',hs.includes('<svg'),'img:',hs.includes('data:image'),'mesas:',hs.includes('<h2>Mesas'),'fone:',hs.includes('99999-1234'),'R$:',(hs.match(/R\$\s?\d.{0,20}/)||[])[0]);
  check('dossiê HTML: cronograma, planta (SVG com a imagem embutida), mesas; sem telefone e sem R$', hs.includes('Cronograma do dia') && hs.includes('<svg') && hs.includes('data:image') && hs.includes('<h2>Mesas') && !hs.includes('99999-1234') && !/R\$\s?\d/.test(hs), hs.length + ' bytes');
  const zipd = await dl(p, () => p.click('text=Tudo num ZIP')); const zl = Z.list(new Uint8Array(zipd.buf)).map(e => e.name);
  check('ZIP para a cerimonialista contém dossiê, 3 CSV, 2 PNG e LEIA-ME', ['dossie-cerimonialista.html', 'convidados.csv', 'mesas.csv', 'cronograma.csv', 'planta.png', 'planta-3d.png', 'LEIA-ME.txt'].every(n => zl.includes(n)) && !zl.includes('parcelas.csv'), zl.join(','));
  const pngIn = zl.includes('planta.png') ? await Z.read(new Uint8Array(zipd.buf), Z.list(new Uint8Array(zipd.buf)).find(e => e.name === 'planta.png')) : null; check('PNG dentro do ZIP é PNG de verdade (assinatura)', pngIn && pngIn[0] === 0x89 && pngIn[1] === 0x50);
  await shot(p, 'cerimonialista');

  // ===================== PACOTE ZIP: exportar → apagar → importar =====================
  await go(p, 'pacote');
  const pkg = await dl(p, () => p.click('button:has-text("Exportar ZIP")')); const pl = Z.list(new Uint8Array(pkg.buf)).map(e => e.name);
  check('pacote do aparelho: backup JSON, manifest e print da planta', pl.includes('nosso-sim-backup.json') && pl.includes('manifest.json') && pl.some(n => /^planta\/print\./.test(n)), pl.join(','));
  const bkp = JSON.parse(await Z.readText(new Uint8Array(pkg.buf), Z.list(new Uint8Array(pkg.buf)).find(e => e.name === 'nosso-sim-backup.json'))); check('backup no ZIP leva v31 (planta, parcelas, cronograma, telefones)', bkp.v31.plan.objects.length >= 4 && bkp.v31.installments.length === 3 && bkp.v31.dayPlan.length === 12 && !!bkp.v31.guestMeta[gid].phone);
  await context.close();
  // aparelho "novo": vazio, sem nada
  const fresh = await openPage(browser, srv.url, { viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); const q = fresh.page; await q.waitForFunction(() => window.V31 && window.V31.version === '3.1');
  check('app abre VAZIO (sem convidados, sem print, sem planta)', await q.evaluate(async () => { const d = window.NossoSim.getData(); return d.guests.length === 0 && !d.v31.plan.base; }));
  await go(q, 'pacote'); const [fc2] = await Promise.all([q.waitForEvent('filechooser'), q.click('text=Escolher o ZIP')]); await fc2.setFiles(pkg.file); await sleep(500);
  check('importar mostra o que há no ZIP antes de aplicar', /Backup \(nosso-sim-backup\.json\) com 3 convite/.test(await q.textContent('#v31-pacote')) && /Print da planta/.test(await q.textContent('#v31-pacote')));
  q.once('dialog', dg => dg.accept()); await q.click('text=Importar e substituir'); await sleep(800);
  d = await data(q); check('importou: convidados, planta, parcelas e cronograma voltaram', d.guests.length === 3 && d.v31.plan.objects.length >= 4 && d.v31.installments.length === 3 && d.v31.dayPlan.length === 12 && d.v31.plan.base.pxPerM > 9);
  check('importou o print para o IndexedDB do aparelho novo', await q.evaluate(async () => { const r = await window.V31.kit.files.get(window.NossoSim.getData().v31.plan.base.key); return !!r && r.blob.size > 1000; }));
  await go(q, 'planta'); await sleep(500);
  check('a planta abre com o print restaurado (sem aviso de print ausente) em 390px', (await q.locator('#v31-planta svg.v31-svg image').count()) === 1 && !/não está neste aparelho/.test(await q.textContent('#v31-planta')));
  await shot(q, 'planta-mobile');
  // zip no formato do pacote privado (seed) — FICTÍCIO
  const seedJs = `window.NS_SEED = ${JSON.stringify({ guests: [{ id: 'r1', name: 'Seed Fictício 1', group: 'Amigos', qty: 2, adults: 2, children: 0, side: 'Gabriel', attendance: 'Pendente', notes: '', source: 'x' }, { id: 'r2', name: 'Seed Fictício 2', group: 'Família', qty: 3, adults: 2, children: 1, side: 'Isabelle', attendance: 'Pendente', notes: '', source: 'x' }], couples: [{ id: 'c1', name: 'Par Fictício', side: 'Gabriel', role: 'Padrinhos', notes: '' }], photoLinks: [{ photo: 'assets/padrinhos/f1.png', label: 'Par Fictício', coupleId: 'c1', status: 'exato' }], settings: { message: 'm' } }, null, 1)};\n`;
  const seedZip = path.join(tmp, 'privado-ficticio.zip'); fs.writeFileSync(seedZip, Z.write([{ name: 'seed/seed-casal.js', data: seedJs }, { name: 'assets/padrinhos/f1.png', data: new Uint8Array(png.subarray(0, 4000)) }, { name: 'index.html', data: '<html></html>' }]));
  await go(q, 'pacote'); const [fc3] = await Promise.all([q.waitForEvent('filechooser'), q.click('text=Escolher o ZIP')]); await fc3.setFiles(seedZip); await sleep(400);
  check('ZIP no formato privado (seed): reconhece e conta convites', /Seed com 2 convite/.test(await q.textContent('#v31-pacote')));
  q.once('dialog', dg => dg.accept()); await q.click('text=Importar e substituir'); await sleep(800); d = await data(q);
  check('seed aplicado: convites e foto de padrinho viram "local:" (IndexedDB)', d.guests.length === 2 && d.padrinhoFotos.length === 1 && d.padrinhoFotos[0].src.startsWith('local:'), JSON.stringify(d.padrinhoFotos));
  // zip malicioso / inválido
  const evil = path.join(tmp, 'evil.zip'); fs.writeFileSync(evil, Z.write([{ name: '../../etc/passwd', data: 'x' }])); const junk = path.join(tmp, 'junk.zip'); fs.writeFileSync(junk, Buffer.from('isto não é zip'));
  await go(q, 'pacote'); for (const [f, re, nm] of [[evil, /perigoso/, 'caminho perigoso'], [junk, /inválido/, 'arquivo que não é ZIP']]) { const [fc4] = await Promise.all([q.waitForEvent('filechooser'), q.click('text=Escolher o ZIP')]); await fc4.setFiles(f); await sleep(300); check(`ZIP com ${nm} é recusado com mensagem`, re.test(await q.evaluate(() => document.getElementById('toast-root')?.textContent || document.body.innerText)) || (await data(q)).guests.length === 2); }
  check('dados anteriores intactos após ZIP recusado', (await data(q)).guests.length === 2);
  // ===================== LAYOUT: sem rolagem horizontal =====================
  for (const [w, hh] of [[360, 800], [390, 844], [1440, 900]]) { await q.setViewportSize({ width: w, height: hh }); let bad = []; for (const k of ['rsvp', 'parcelas', 'planta', 'dia', 'cerimonialista', 'pacote']) { await go(q, k); if (await hscroll(q)) bad.push(k); } check(`sem rolagem horizontal em ${w}x${hh} (6 seções)`, !bad.length, bad.join(',')); }
  check('nenhum pedido a hosts externos (tudo local)', fresh.log.external.length === 0 && log.external.length === 0, [...fresh.log.external, ...log.external].join(','));
  check('sem erros de página no aparelho novo', fresh.log.errors.length === 0, fresh.log.errors.join('|'));
} finally { await browser.close(); await srv.close(); }
const { failed } = R.summary(); process.exit(failed.length ? 1 : 0);
