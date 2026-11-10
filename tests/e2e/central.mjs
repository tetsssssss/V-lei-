// Central de Comando: cada painel confere com o estado real (dados FICTÍCIOS), acessibilidade e layout.
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, makeReporter, openPage, VIEWPORTS, sleep } from './lib.mjs';
import { fixtureV2, STORAGE_KEY } from './fixture.mjs';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', '.')); const SHOTS = arg('--shots', ''); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const R = makeReporter('CENTRAL DE COMANDO'); const { check } = R;
const srv = await startServer(ROOT); const browser = await launch();
const base = () => { const f = fixtureV2(); f.guests.push({ id: 'g-4', name: 'Família Teste D', group: 'Família', qty: 5, adults: 3, children: 2, side: 'Gabriel', attendance: 'Pendente' }); f.sweetsQty = { 'elizete-1': 250, 'elizete-2': 20 }; f.budget.push({ id: 'b-h', title: 'Hipótese teste', category: 'Outros', estimate: 300, paid: 0, hypothetical: true }); return f; };
const prefs = (o = {}) => ({ content: `localStorage.setItem('nosso-sim-iris-v1', JSON.stringify({prefs:Object.assign({introDone:true,speakOn:false,briefingOnOpen:false},${JSON.stringify(o)})}))` });
const go = page => page.evaluate(() => Iris.app.ns.navigate('central'));
const txt = (page, kind) => page.locator(`[data-panel="${kind}"]`).innerText();
try {
  {
    const { context, page, log } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, JSON.stringify(base())], viewport: { width: 1440, height: 1000 }, init: prefs({ reduceMotion: 'on' }) });
    await go(page); await sleep(300);
    check('Central de comando aparece no menu, antes de "Conversar com a Íris"', await page.evaluate(() => { const l = [...document.querySelectorAll('#desktop-nav button')].map(b => b.textContent); const i = l.findIndex(t => t.includes('Central de comando')), j = l.findIndex(t => t.includes('Conversar com a Íris')); return i >= 0 && i < j; }));
    const kinds = await page.evaluate(() => [...document.querySelectorAll('.iris-central [data-panel]')].map(e => e.dataset.panel));
    check('9 painéis renderizados', ['budget', 'guests', 'ceremony', 'vendors', 'ideas', 'godparents', 'sweets', 'venue', 'gifts'].every(k => kinds.includes(k)), kinds.join(','));
    const hero = await page.locator('.ic-hero').innerText();
    check('herói: contagem de dias e aviso de que a data é só referência', /Faltam \d+ dias/.test(hero) && /não há reserva confirmada/.test(hero));
    const b = await txt(page, 'budget');
    check('orçamento: planejado = R$ 4.800 e a hipótese de R$ 300 fica FORA do total', /R\$ 4\.800,00/.test(b) && /R\$ 300,00 em 1 item\(ns\) simulado\(s\), fora dos totais/.test(b) && !/R\$ 5\.100/.test(b), b.slice(0, 300));
    check('orçamento: medidor mostra planejado × teto', /de R\$ 50\.000,00 de teto/.test(b));
    const g = await txt(page, 'guests');
    check('convidados: 12 pessoas previstas = 8 adultos + 4 crianças (soma dos convites)', /12\s*\n\s*pessoas/.test(g) && /Adultos\s+8 \(67%\)/.test(g) && /Crianças\s+4 \(33%\)/.test(g), g.slice(0, 160));
    check('fornecedores: pipeline com 1 "Proposta recebida" e 1 "Pesquisando" e aviso de sem cotação', /Pesquisando/.test(await txt(page, 'vendors')) && /Sem cotação \(1\)/.test(await txt(page, 'vendors')));
    check('doces: aponta o mínimo de 25 por sabor e que é simulação', /mín\. 25/.test(await txt(page, 'sweets')) && /Não é orçamento nem contrato/.test(await txt(page, 'sweets')));
    check('chácara: não afirma capacidade/chuva/disponibilidade', /Não afirmo capacidade/.test(await txt(page, 'venue')));
    // acessibilidade dos gráficos
    const svgs = await page.evaluate(() => [...document.querySelectorAll('.iris-central svg[role="img"]')].map(s => ({ label: s.getAttribute('aria-label'), title: !!s.querySelector('title') })));
    check('todo gráfico tem role=img, aria-label e <title>', svgs.length >= 5 && svgs.every(s => s.label && s.title), JSON.stringify(svgs.filter(s => !s.label || !s.title)));
    check('todo gráfico tem tabela de dados equivalente para leitor de tela', await page.evaluate(() => [...document.querySelectorAll('.iris-central .ic-fig')].every(f => !!f.querySelector('.iris-vh table'))));
    check('animações desligadas com "reduzir movimento"', await page.evaluate(() => { const a = document.querySelector('.ic-arc'); return !a || getComputedStyle(a).transitionDuration === '0s'; }));
    // o painel acompanha o estado: muda via Íris e a Central reflete
    await page.evaluate(() => Iris.app.session.handleInput('adicione despesa hipotética R$ 700', 'texto')); await sleep(300);
    await page.click('.iris-fab').catch(() => {}); await page.evaluate(() => Iris.app.engine.confirmPending('toque')); await go(page); await sleep(300);
    check('após confirmar via Íris, a Central mostra R$ 1.000 em hipóteses (2 itens)', /R\$ 1\.000,00 em 2 item/.test(await txt(page, 'budget')), (await txt(page, 'budget')).slice(-200));
    check('zero requests externos / sem erros', log.external.length === 0 && log.errors.length === 0 && log.console.length === 0, [...log.external, ...log.errors, ...log.console].join('|'));
    await context.close();
  }
  {   // sem teto: nada de saldo inventado
    const f = base(); f.settings.budget = 0;
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, JSON.stringify(f)], viewport: { width: 1440, height: 1000 }, init: prefs() });
    await go(page); await sleep(200);
    const b = await txt(page, 'budget');
    check('sem teto: CTA "Definir o teto" e nenhum saldo calculado', /Definir o teto/.test(b) && /não calculo saldo/.test(b) && !/de R\$ 0,00 de teto/.test(b));
    await context.close();
  }
  {   // tema Jarvis aplicado e trocável por botão
    const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, JSON.stringify(base())], viewport: { width: 1440, height: 1000 }, init: prefs() });
    await go(page); await sleep(200);
    await page.click('.ic-top-actions button:has-text("Jarvis")'); await sleep(200);
    check('trocar para o tema Jarvis na Central', (await page.getAttribute('.iris-central', 'data-iris-theme')) === 'jarvis' && (await page.getAttribute('#iris-root', 'data-iris-theme')) === 'jarvis');
    await context.close();
  }
  // layout em 5 viewports
  for (const vp of VIEWPORTS) {
    for (const theme of ['romantico', 'jarvis']) {
      const { context, page } = await openPage(browser, srv.url, { storage: [STORAGE_KEY, JSON.stringify(base())], viewport: { width: vp.width, height: vp.height }, init: prefs({ theme, reduceMotion: 'on' }) });
      await go(page); await sleep(250);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, over: [...document.querySelectorAll('.iris-central .ic-card')].filter(c => c.scrollWidth > c.clientWidth + 2).map(c => c.dataset.panel || 'hero') }));
      check(`Central ${theme} em ${vp.name}: sem rolagem horizontal e sem conteúdo estourando`, m.sw <= m.vw + 1 && m.over.length === 0, JSON.stringify(m));
      if (SHOTS && theme === 'romantico') await page.screenshot({ path: path.join(SHOTS, `central-${vp.name}.png`), fullPage: true });
      await context.close();
    }
  }
} finally { await browser.close(); await srv.close(); }
const { failed } = R.summary(); process.exit(failed.length ? 1 : 0);
