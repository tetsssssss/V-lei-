/* Íris · dashboard.js — Central de Comando: briefing, contagem e painéis com os números reais do casamento. */
(function () {
  'use strict';
  const Iris = window.Iris; if (!Iris || !Iris.livePanels) return;
  const { h } = Iris.dom, T = Iris.text, C = Iris.charts;
  const ORDER = [['budget', 'wide'], ['guests', ''], ['ceremony', ''], ['vendors', ''], ['ideas', ''], ['godparents', 'wide'], ['sweets', ''], ['venue', 'wide'], ['gifts', '']];

  function mount(ns, ctx) {
    const rootEl = document.getElementById('iris-central'); if (!rootEl) return;
    const prefs = ctx.store.get().prefs, d = ns.getData(), b = Iris.briefing.build(ns), days = ns.helpers.daysUntil();
    rootEl.setAttribute('data-iris-theme', prefs.theme);
    rootEl.replaceChildren();

    const ask = text => { ctx.panel.open({ peek: true }); ctx.session.sendText(text); };
    const spoken = `${b.headline} ${b.priorities.length ? 'Prioridades: ' + b.priorities.map(p => p.text).join('; ') + '.' : 'Não há pendências abertas.'}`;

    // ----- cabeçalho -----
    const themeBtn = (v, label) => h('button', { type: 'button', 'aria-pressed': String(prefs.theme === v), onclick: () => { ctx.store.setPref('theme', v); ctx.panel.apply(); mount(ns, ctx); } }, label);
    rootEl.append(h('header', { class: 'ic-top' },
      h('div', {}, h('h1', { class: 'ic-h1', text: 'Central de comando' }), h('p', { class: 'ic-sub', text: `${d.settings.personA} & ${d.settings.personB} · tudo o que está cadastrado, num só lugar.` })),
      h('div', { class: 'ic-top-actions' }, h('div', { class: 'iris-actor', role: 'group', 'aria-label': 'Tema' }, themeBtn('romantico', 'Romântico'), themeBtn('jarvis', 'Jarvis')),
        h('button', { class: 'iris-btn iris-btn--primary', type: 'button', onclick: () => ctx.panel.open() }, 'Falar com a Íris'))));

    // ----- herói: contagem + briefing -----
    const num = h('span', { class: 'ic-days', text: days === null ? '—' : '0' }); if (days !== null) C.countUp(num, Math.max(0, days));
    const hero = h('section', { class: 'ic-card ic-hero', 'aria-label': 'Briefing da Íris' },
      h('div', { class: 'ic-hero-count' }, num, h('span', { class: 'ic-hero-unit', text: days === 1 ? 'dia' : 'dias' })),
      h('div', { class: 'ic-hero-body' },
        h('h2', { class: 'ic-hero-h', text: b.headline }),
        b.priorities.length ? h('ol', { class: 'ic-prio' }, ...b.priorities.map(p => h('li', {}, h('button', { class: 'ic-todo-btn', type: 'button', onclick: () => ns.navigate(p.section) }, h('span', { text: p.text }))))) : h('p', { class: 'ic-note', text: 'Sem pendências abertas no que está cadastrado.' }),
        b.alerts.length ? h('ul', { class: 'ic-alerts' }, ...b.alerts.slice(0, 4).map(a => h('li', { class: a.level }, h('span', { class: 'iris-chip-static ' + (a.level === 'warn' ? 'warn' : ''), text: a.level === 'warn' ? 'Atenção' : 'Aviso' }), ' ' + a.text))) : null,
        h('div', { class: 'ic-hero-actions' },
          h('button', { class: 'iris-btn', type: 'button', onclick: () => { ctx.panel.open({ peek: true }); ctx.session.speakText(spoken); } }, 'Ouvir o briefing'),
          ...[['Quanto falta organizar?', 'quanto falta organizar'], ['Resumo do orçamento', 'mostre o saldo'], ['Quantas crianças?', 'quantas crianças estão previstas']].map(([l, say]) => h('button', { class: 'iris-chip', type: 'button', onclick: () => ask(say) }, l)))));
    rootEl.append(hero);

    // ----- grade de painéis -----
    const grid = h('div', { class: 'ic-grid' });
    for (const [kind, span] of ORDER) {
      const node = Iris.livePanels.build(kind, ns, { className: 'ic-panel ' + span, big: true });
      if (node) grid.append(node);
    }
    rootEl.append(grid);
    rootEl.append(h('p', { class: 'ic-foot', text: 'Os números vêm direto do app e se atualizam a cada alteração. Simulações e hipóteses ficam sempre identificadas: não são contratos nem pagamentos.' }));
  }

  Iris.dashboard = {
    register(ns, ctx) {
      ns.registerSection('central', { title: 'Central de comando', icon: '◈', position: 1, render: () => '<div class="iris-central" id="iris-central" aria-live="polite"></div>' });
      ns.onRender(sec => { if (sec === 'central') mount(ns, ctx); });
    },
    mount,
  };
})();
