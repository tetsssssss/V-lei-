// Suíte BASELINE: prova que o app existente (V2.1) continua funcionando.
// Uso: node tests/e2e/baseline.mjs --root <pasta-do-app> [--expect-seed] [--shots <pasta>]
// Roda contra o index.html ORIGINAL (Fase 0) e contra o build novo (regressão, Fases 1+).
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, makeReporter, openPage, VIEWPORTS, sleep } from './lib.mjs';
import { fixtureV2, fixtureLegacyV1, STORAGE_KEY } from './fixture.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '.'));
const EXPECT_SEED = process.argv.includes('--expect-seed');
const SHOTS = arg('--shots', '');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const SECTIONS = ['inicio', 'album', 'orcamento', 'convidados', 'padrinhos', 'doces', 'presentes', 'pesquisas', 'fornecedores', 'cerimonia', 'ideias', 'consultores', 'ajustes'];
const R = makeReporter(`BASELINE (${ROOT})`);
const { check } = R;

const goto = (page, s) => page.evaluate(sec => {
  const d = document.querySelector(`#desktop-nav [data-section="${sec}"]`);
  if (d && d.offsetParent) { d.click(); return 'desktop'; }
  document.querySelector('[data-action="more"]').click();
  document.querySelector(`#modal-root [data-section="${sec}"]`).click();
  return 'more';
}, s);
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), STORAGE_KEY);
const fix = JSON.stringify(fixtureV2());

const srv = await startServer(ROOT);
const browser = await launch();
try {
  // 1) Carga limpa, sem erros, sem requests externos, 13 seções renderizam
  {
    const { context, page, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 1440, height: 900 } });
    check('app abre e #content renderiza', (await page.locator('#content').innerHTML()).length > 500);
    for (const s of SECTIONS) {
      await goto(page, s);
      const len = (await page.locator('#content').innerHTML()).length;
      check(`seção "${s}" renderiza`, len > 300, `len=${len}`);
    }
    check('sem erros de console/página', log.console.length === 0 && log.errors.length === 0, [...log.console, ...log.errors].join(' | '));
    check('zero requests para origens externas', log.external.length === 0, log.external.join(', '));
    await context.close();
  }

  // 2) Orçamento: criar, editar, excluir; persiste após recarregar
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 1440, height: 900 } });
    page.on('dialog', d => d.accept());
    await goto(page, 'orcamento');
    await page.click('.page-intro ~ .section-head [data-action="add-budget"]');
    await page.fill('#f-title', 'Item criado no teste');
    await page.selectOption('#f-category', 'Decoração');
    await page.fill('#f-estimate', '1234.5');
    await page.fill('#f-paid', '100');
    await page.click('#edit-form button[type="submit"]');
    let d = await stored(page);
    const created = d.budget.find(x => x.title === 'Item criado no teste');
    check('orçamento: item criado e salvo', created && created.estimate === 1234.5 && created.paid === 100, JSON.stringify(created));
    await page.reload(); await page.waitForSelector('#content');
    d = await stored(page);
    check('orçamento: persiste após recarregar', d.budget.some(x => x.title === 'Item criado no teste'));
    await goto(page, 'orcamento');
    await page.click(`[data-action="edit-budget"][data-id="${created.id}"]`);
    await page.fill('#f-estimate', '2000');
    await page.click('#edit-form button[type="submit"]');
    d = await stored(page);
    check('orçamento: edição salva', d.budget.find(x => x.id === created.id).estimate === 2000);
    await page.click(`[data-action="delete"][data-type="budget"][data-id="${created.id}"]`);
    d = await stored(page);
    check('orçamento: exclusão remove só o item', !d.budget.some(x => x.id === created.id) && d.budget.length === 2);
    // regra do formulário: pago não pode passar do planejado
    await page.click('.page-intro ~ .section-head [data-action="add-budget"]');
    await page.fill('#f-title', 'Inválido'); await page.fill('#f-estimate', '10'); await page.fill('#f-paid', '20');
    await page.click('#edit-form button[type="submit"]');
    d = await stored(page);
    check('orçamento: pago > planejado é rejeitado', !d.budget.some(x => x.title === 'Inválido'));
    await context.close();
  }

  // 3) Convidados: status e busca persistem
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 1440, height: 900 } });
    await goto(page, 'convidados');
    await page.selectOption('select[data-change="guest-status"][data-id="g-1"]', 'Confirmado');
    let d = await stored(page);
    check('convidado: status muda e salva', d.guests.find(g => g.id === 'g-1').attendance === 'Confirmado');
    await page.fill('#guest-search', 'Família');
    const items = await page.locator('#content .item').count();
    check('convidado: busca filtra a lista', items === 1, `itens=${items}`);
    await context.close();
  }

  // 4) Fornecedor → orçamento sem duplicar
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 1440, height: 900 } });
    await goto(page, 'fornecedores');
    const sel = '[data-action="transfer-vendor"][data-id="v-buffet"]';
    await page.click(sel); await page.click(sel); await page.click(sel);
    const d = await stored(page);
    const linked = d.budget.filter(b => b.vendorId === 'v-buffet');
    check('fornecedor→orçamento: 3 cliques geram 1 item (sem duplicar)', linked.length === 1 && linked[0].estimate === 5000, `n=${linked.length}`);
    check('fornecedor→orçamento: não marca como contratado/pago', linked[0].paid === 0 && d.vendors.find(v => v.id === 'v-buffet').status === 'Proposta recebida');
    await context.close();
  }

  // 5) Doces: simulação (250 × R$ 4,50) e não vira contrato
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 1440, height: 900 } });
    await goto(page, 'doces');
    await page.fill('input[data-change="sweet-qty"][data-id="elizete-1"]', '250');
    await page.dispatchEvent('input[data-change="sweet-qty"][data-id="elizete-1"]', 'change');
    const text = await page.locator('#content').innerText();
    check('doces: subtotal simulado de 250 × R$ 4,50 = R$ 1.125,00', /1\.125,00/.test(text), text.match(/Subtotal simulado[\s\S]{0,60}/)?.[0]);
    const d = await stored(page);
    check('doces: simulação fica em sweetsQty, sem criar item de orçamento', d.sweetsQty['elizete-1'] === 250 && d.budget.length === 2);
    await context.close();
  }

  // 6) Exportar / importar backup JSON
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: 1440, height: 900 } });
    page.on('dialog', d => d.accept());
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.top-actions [data-action="export"]')]);
    const file = await dl.path();
    const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
    check('export: gera JSON com todos os dados do fixture', exported.budget.length === 2 && exported.guests.length === 3 && exported.couples.length === 3 && exported.vendors.length === 2);
    const modified = { ...exported, budget: [...exported.budget, { id: 'imp-1', title: 'Item vindo do backup', category: 'Outros', estimate: 77, paid: 0 }] };
    const tmp = path.join(path.dirname(file), 'import-test.json'); fs.writeFileSync(tmp, JSON.stringify(modified));
    await page.setInputFiles('#import-json', tmp);
    await sleep(300);
    const d = await stored(page);
    check('import: substitui os dados e persiste', d.budget.some(b => b.id === 'imp-1') && d.budget.length === 3);
    await context.close();
  }

  // 7) Migração do localStorage legado v1 (chave preservada, nada apagado)
  {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, JSON.stringify(fixtureLegacyV1())], viewport: { width: 1440, height: 900 } });
    const d = await stored(page);
    check('migração v1→v2: versão sobe para 2 e é gravada', d.version === 2, `version=${d.version}`);
    check('migração v1→v2: preserva orçamento, tarefas, roteiro e ideias do usuário',
      d.budget[0]?.title === 'Item legado V1' && d.tasks[0]?.title === 'Tarefa legada V1' && d.timeline[0]?.title === 'Momento legado' && d.ideas[0]?.title === 'Ideia legada');
    check('migração v1→v2: preenche nomes/data padrão sem apagar o teto', d.settings.personA === 'Gabriel' && d.settings.personB === 'Isabelle' && d.settings.date === '2027-11-13' && d.settings.budget === 12345);
    if (EXPECT_SEED) check('migração v1→v2: lista de convidados semeada (seed privado presente)', d.guests.length >= 40, `guests=${d.guests.length}`);
    await context.close();
  }

  // 8) Sem rolagem horizontal: 13 seções × 5 viewports
  for (const vp of VIEWPORTS) {
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, fix], viewport: { width: vp.width, height: vp.height } });
    const bad = [];
    for (const s of SECTIONS) {
      await goto(page, s); await sleep(60);
      const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (w.sw > w.iw + 1) bad.push(`${s}(${w.sw}>${w.iw})`);
      if (SHOTS && (s === 'inicio' || s === 'orcamento' || s === 'padrinhos')) await page.screenshot({ path: path.join(SHOTS, `${vp.name}-${s}.png`) });
    }
    check(`sem rolagem horizontal em ${vp.name} (13 seções)`, bad.length === 0, bad.join(', '));
    await context.close();
  }
} finally {
  await browser.close(); await srv.close();
}
const { failed } = R.summary();
process.exit(failed.length ? 1 : 0);
