/* Íris · live-panels.js — painéis com os números REAIS (lidos do estado do app a cada render).
   Usados na tela de voz ("painéis vivos") e na Central de Comando. Nada aqui inventa valores. */
(function () {
  'use strict';
  const Iris = window.Iris; if (!Iris || !Iris.dom || !Iris.charts) return;
  const { h } = Iris.dom, C = Iris.charts, T = Iris.text;
  const PAL = ['var(--i-chart-1)', 'var(--i-chart-2)', 'var(--i-chart-3)', 'var(--i-chart-4)', 'var(--i-chart-5)'];
  const fmt = v => T.fmtBRL(v);
  const SECTION = { overview: 'inicio', countdown: 'central', budget: 'orcamento', guests: 'convidados', godparents: 'padrinhos', vendors: 'fornecedores', sweets: 'doces', ceremony: 'cerimonia', ideas: 'ideias', venue: 'pesquisas', remaining: 'central', scenarios: 'convidados', gifts: 'presentes' };
  const TITLE = { overview: 'Visão geral', countdown: 'Contagem regressiva', budget: 'Orçamento', guests: 'Convidados', godparents: 'Padrinhos', vendors: 'Fornecedores', sweets: 'Doces Elizete (simulação)', ceremony: 'Cerimônia e tarefas', ideas: 'Ideias do casal', venue: 'Chácara Veneza', remaining: 'O que falta organizar', scenarios: 'Cenários de convidados', gifts: 'Lista de presentes' };

  const note = text => h('p', { class: 'ic-note', text });
  const chip = (text, tone) => h('span', { class: 'iris-chip-static' + (tone ? ' ' + tone : ''), text });

  const B = {}; // construtores: (ns, opts) → array de nós

  B.countdown = (ns, o) => {
    const d = ns.getData(), days = ns.helpers.daysUntil();
    const created = Date.parse(d.created) || Date.now(), end = Date.parse(d.settings.date + 'T12:00:00'), span = Math.max(1, end - created);
    const p = days === null ? 0 : C.clamp((Date.now() - created) / span * 100, 0, 100);
    const venue = Iris.briefing.venueOf(d), reserved = venue && venue.status === 'Fechado';
    return [C.ring({ pct: p, size: o.big ? 168 : 132, stroke: 13, big: days === null ? '—' : String(Math.max(0, days)), small: days === null ? 'sem data' : days === 1 ? 'dia' : 'dias', title: 'Contagem regressiva', desc: days === null ? 'data não definida' : `faltam ${days} dias até ${T.fmtDateBR(d.settings.date)}` }),
      note(`Data de referência: ${T.fmtDateBR(d.settings.date)}. ${reserved ? 'Local com contrato registrado.' : 'Ainda sem reserva confirmada.'}`)];
  };

  B.budget = (ns, o) => {
    const s = ns.helpers.sums(), d = ns.getData(), real = d.budget.filter(x => !x.hypothetical);
    const cats = {}; real.forEach(x => { cats[x.category] = (cats[x.category] || 0) + Number(x.estimate || 0); });
    const items = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: PAL[i % PAL.length], text: fmt(value) }));
    const out = [];
    if (s.limit) out.push(C.gauge({ model: C.gaugeModel(s.planned, s.limit, s.reserve), big: fmt(s.planned), bigSize: 21, small: `de ${fmt(s.limit)} de teto`, title: 'Planejado × teto' }));
    else out.push(h('div', { class: 'ic-empty' }, h('b', { text: fmt(s.planned) }), h('span', { text: 'planejado. O teto ainda não foi definido, então não calculo saldo.' }), h('button', { class: 'iris-btn', type: 'button', onclick: () => ns.navigate('ajustes') }, 'Definir o teto')));
    out.push(C.donut({ items, bigText: C.compactBRL(s.planned), bigSize: 17, smallText: 'planejado', title: 'Por categoria', emptyText: 'Sem itens ainda' }));
    out.push(C.hbars({ title: 'Pago × em aberto', items: [{ label: 'Pago', value: s.paid, max: Math.max(1, s.planned), color: 'var(--i-ok)', text: fmt(s.paid) }, { label: 'Em aberto', value: s.open, max: Math.max(1, s.planned), color: 'var(--i-chart-2)', text: fmt(s.open) }] }));
    if (s.hypoCount) out.push(h('p', { class: 'ic-hyp' }, chip('Hipótese', 'warn'), ` ${fmt(s.hypo)} em ${s.hypoCount} item(ns) simulado(s), fora dos totais acima.`));
    return out;
  };

  B.guests = (ns, o) => {
    const d = ns.getData(), g = ns.helpers.guestsInfo();
    const complete = d.guests.every(x => x.adults !== undefined && x.children !== undefined);
    const adults = d.guests.reduce((n, x) => n + (Number(x.adults) || 0), 0), kids = d.guests.reduce((n, x) => n + (Number(x.children) || 0), 0);
    const side = sd => d.guests.filter(x => x.side === sd).reduce((n, x) => n + Math.max(1, Number(x.qty) || 0), 0);
    const items = complete ? [{ label: 'Adultos', value: adults, color: 'var(--i-chart-1)' }, { label: 'Crianças', value: kids, color: 'var(--i-chart-2)' }] : [{ label: 'Previstos', value: g.total, color: 'var(--i-chart-1)' }];
    const answered = g.yes + g.no;
    const out = [C.donut({ items, bigText: String(g.total), bigSize: 30, smallText: 'pessoas', title: 'Adultos e crianças', emptyText: 'Sem convidados' }),
      C.hbars({ title: 'Por lado', items: ['Gabriel', 'Isabelle', 'Ambos'].map((sd, i) => ({ label: sd, value: side(sd), max: Math.max(1, g.total), color: PAL[i], text: String(side(sd)) })) }),
      C.hbars({ title: 'Respostas de presença', items: [{ label: 'Previstos', value: g.total, max: Math.max(1, g.total), color: 'var(--i-chart-1)', text: String(g.total) }, { label: 'Responderam', value: answered, max: Math.max(1, g.total), color: 'var(--i-chart-3)', text: String(answered) }, { label: 'Confirmados', value: g.yes, max: Math.max(1, g.total), color: 'var(--i-ok)', text: String(g.yes) }] })];
    (d.sourceNotes || []).forEach(t => out.push(h('p', { class: 'ic-warn' }, chip('Atenção', 'warn'), ' ' + t)));
    const mm = Iris.briefing.guestMismatch(d).length; if (mm) out.push(h('p', { class: 'ic-warn' }, chip('Conferir', 'warn'), ` ${T.plural(mm, 'convite')} com adultos + crianças diferente do total.`));
    return out;
  };

  B.godparents = (ns, o) => {
    const d = ns.getData(), pairs = d.couples.filter(c => c.role !== 'Entrada'), links = d.padrinhoFotos || [];
    const strip = h('div', { class: 'ic-strip', role: 'list', tabindex: '0', 'aria-label': 'Pares de padrinhos' });
    pairs.forEach(c => {
      const l = links.find(x => x.coupleId === c.id);
      strip.append(h('figure', { class: 'ic-pair', role: 'listitem' },
        l && Iris.padrinhosFotos ? h('button', { class: 'pf-open', type: 'button', 'aria-label': `Abrir foto: ${l.label}`, onclick: () => ns.navigate('padrinhos') }, Iris.padrinhosFotos.frame(l)) : h('div', { class: 'pf-box ic-nophoto' }, h('span', { class: 'pf-missing', text: 'Sem foto' })),
        h('figcaption', {}, h('strong', { text: c.name }), l && l.status === 'sugerido' ? chip('Revisar', 'warn') : null)));
    });
    return [note(`${T.plural(pairs.length, 'par', 'pares')} de padrinhos · ${links.length} com foto. As fotos ficam só neste aparelho e a Íris não reconhece rostos: vale a legenda de vocês.`), pairs.length ? strip : note('Nenhum par cadastrado ainda.')];
  };

  B.vendors = (ns, o) => {
    const d = ns.getData(), noQuote = d.vendors.filter(v => !Number(v.quote) && v.status !== 'Descartado');
    return [C.pipeline(C.pipelineModel(d.vendors), 'Fornecedores por etapa'), note('Pesquisar não é contratar: só "Fechado" indica contrato.'),
      noQuote.length ? h('div', { class: 'ic-list' }, h('b', { text: `Sem cotação (${noQuote.length})` }), h('ul', {}, ...noQuote.slice(0, 5).map(v => h('li', { text: `${v.name} · ${v.kind}` })))) : note('Todos os fornecedores ativos têm cotação cadastrada.')];
  };

  B.sweets = (ns, o) => {
    const d = ns.getData(), cat = ns.catalogs.sweetCatalog, sel = cat.filter(x => Number(d.sweetsQty[x.id]) > 0);
    if (!sel.length) return [note('Nenhuma quantidade na simulação. Diga, por exemplo: "quanto custam 250 doces de R$ 4,50?"')];
    const min = x => (x.unit === 'kg' ? 2 : 25), total = sel.reduce((n, x) => n + Number(d.sweetsQty[x.id]) * x.price, 0), guests = ns.helpers.guestsInfo().total;
    return [C.hbars({ title: 'Quantidade × mínimo', items: sel.slice(0, 8).map(x => ({ label: x.name, value: Number(d.sweetsQty[x.id]), max: Math.max(min(x) * 2, Number(d.sweetsQty[x.id])), color: Number(d.sweetsQty[x.id]) >= min(x) ? 'var(--i-ok)' : 'var(--i-warn)', text: `${d.sweetsQty[x.id]} ${x.unit}${Number(d.sweetsQty[x.id]) < min(x) ? ` (mín. ${min(x)})` : ''}` })) }),
      h('p', { class: 'ic-note' }, `Subtotal simulado: ${fmt(total)}${guests ? ` · cerca de ${fmt(total / guests)} por pessoa prevista (hipótese)` : ''}. Não é orçamento nem contrato.`)];
  };

  B.ceremony = (ns, o) => {
    const d = ns.getData(), t = ns.helpers.complete(), pend = d.tasks.filter(x => !x.done);
    const end = Date.parse(d.settings.date + 'T12:00:00'), now = Date.now();
    const marks = d.tasks.filter(x => x.due).map(x => ({ label: x.title, ms: Date.parse(x.due + 'T12:00:00'), done: x.done })).filter(m => !isNaN(m.ms));
    return [C.ring({ pct: t.pct, size: 120, stroke: 11, big: `${t.done}/${t.all}`, small: 'tarefas', title: 'Checklist', desc: `${t.pct}% concluído`, color: 'var(--i-ok)' }),
      isNaN(end) ? null : C.timeline({ model: C.timelineModel(now, end, marks) }),
      pend.length ? h('div', { class: 'ic-list' }, h('b', { text: 'Próximos passos' }), h('ul', {}, ...pend.slice(0, 4).map(x => h('li', { text: x.title })))) : note('Sem tarefas pendentes.'),
      d.timeline.length ? null : note('O roteiro da cerimônia ainda está em branco.')].filter(Boolean);
  };

  B.ideas = (ns, o) => {
    const ideas = ns.getData().ideas, both = ideas.filter(x => x.votes && x.votes.a === 'sim' && x.votes.b === 'sim'), diff = ideas.filter(x => x.votes && x.votes.a && x.votes.b && x.votes.a !== x.votes.b), wait = ideas.length - both.length - diff.length - ideas.filter(x => x.votes && x.votes.a && x.votes.b && x.votes.a === x.votes.b && x.votes.a !== 'sim').length;
    if (!ideas.length) return [note('Ainda não há ideias guardadas.')];
    return [C.hbars({ title: 'Consenso do casal', items: [{ label: 'Os dois amaram', value: both.length, max: ideas.length, color: 'var(--i-ok)', text: String(both.length) }, { label: 'Vale conversar', value: diff.length, max: ideas.length, color: 'var(--i-warn)', text: String(diff.length) }, { label: 'Aguardando votos', value: Math.max(0, wait), max: ideas.length, color: 'var(--i-chart-3)', text: String(Math.max(0, wait)) }] }),
      both.length ? h('div', { class: 'ic-list' }, h('b', { text: 'Amadas pelos dois' }), h('ul', {}, ...both.slice(0, 3).map(x => h('li', { text: x.title })))) : null,
      diff.length ? h('div', { class: 'ic-list' }, h('b', { text: 'Opiniões diferentes' }), h('ul', {}, ...diff.slice(0, 3).map(x => h('li', { text: x.title })))) : null].filter(Boolean);
  };

  B.venue = (ns, o) => {
    const v = Iris.briefing.venueOf(ns.getData()); if (!v) return [note('Nenhum local cadastrado.')];
    const gaps = ['Contrato', 'Valor e orçamento', 'Data reservada', 'Capacidade', 'Cardápio incluso', 'Plano B para chuva', 'Regras de som e horário', 'Fornecedores externos permitidos'];
    return [h('p', {}, chip(v.status, v.status === 'Fechado' ? 'ok' : 'warn'), ` ${Number(v.quote) ? fmt(v.quote) : 'sem orçamento'}`), note('Não afirmo capacidade, cardápio, chuva nem disponibilidade: nada disso está cadastrado.'), h('ul', { class: 'ic-checks' }, ...gaps.map(g => h('li', {}, h('span', { 'aria-hidden': 'true', text: '☐' }), ' ' + g)))];
  };

  B.remaining = (ns, o) => {
    const rem = Iris.briefing.remaining(ns);
    return [h('ul', { class: 'ic-todo' }, ...rem.items.map(i => h('li', {}, h('button', { class: 'ic-todo-btn', type: 'button', onclick: () => ns.navigate(i.section) }, h('b', { text: String(i.count) }), h('span', { text: i.text })))), rem.items.length ? null : h('li', { text: 'Sem pendências cadastradas.' })), note(rem.definition)];
  };

  B.scenarios = (ns, o) => {
    const rows = (o.turn && o.turn.data) || []; if (!rows.length) return [note('Peça: "monta um cenário de 80, 100 e 120 convidados".')];
    const max = Math.max(...rows.map(r => r.sweets), 1);
    return [C.hbars({ title: 'Custo simulado de doces por cenário', items: rows.map((r, i) => ({ label: `${r.n} convidados`, value: r.sweets, max, color: PAL[i % PAL.length], text: fmt(r.sweets) })) }), note('Hipóteses explícitas (editáveis); o número real de convidados não foi alterado.')];
  };

  B.gifts = (ns, o) => {
    const g = ns.getData().gifts, priced = g.filter(x => Number(x.price) > 0).length;
    return [C.hbars({ title: 'Presentes', items: [{ label: 'Com preço de referência', value: priced, max: Math.max(1, g.length), color: 'var(--i-chart-1)', text: String(priced) }, { label: 'A cotar', value: g.length - priced, max: Math.max(1, g.length), color: 'var(--i-chart-3)', text: String(g.length - priced) }] }), note('Preço de referência não é média entre lojas: tem fonte e data.')];
  };

  B.overview = (ns, o) => [...B.countdown(ns, o), ...B.ceremony(ns, o).slice(0, 1)];

  /** Nó do painel (cabeçalho + conteúdo). */
  function build(kind, ns, o = {}) {
    const f = B[kind]; if (!f) return null;
    const body = f(ns, o).filter(Boolean);
    const head = h('header', { class: 'ic-head' }, h('h3', { class: 'ic-title', text: TITLE[kind] || kind }),
      o.actions === false ? null : h('div', { class: 'ic-head-actions' },
        SECTION[kind] && SECTION[kind] !== 'central' ? h('button', { class: 'iris-btn ic-open', type: 'button', onclick: () => { ns.navigate(SECTION[kind]); o.afterOpen && o.afterOpen(); } }, 'Abrir') : null,
        o.onClose ? h('button', { class: 'iris-icon-btn', type: 'button', 'aria-label': 'Fechar painel', onclick: o.onClose }, '✕') : null));
    return h('section', { class: 'ic-card' + (o.className ? ' ' + o.className : ''), 'data-panel': kind, 'aria-label': TITLE[kind] || kind }, head, ...body);
  }

  /** Mostra um painel vivo na tela de voz. */
  function show(kind, ns, container, o = {}) {
    const node = build(kind, ns, { ...o, afterOpen: () => o.engine && Iris.app && Iris.app.panel.setMode('peek'), onClose: () => { container.classList.remove('has'); const r = document.getElementById('iris-root'); r && r.classList.remove('iris-has-live'); container.replaceChildren(h('p', { class: 'iris-live-empty', text: 'Quando eu falar de orçamento, convidados ou padrinhos, os números reais aparecem aqui.' })); } });
    if (!node) return;
    node.classList.add('iris-live-card'); container.classList.add('has'); container.replaceChildren(node);
  }

  Iris.livePanels = { build, show, TITLE, SECTION, kinds: Object.keys(B) };
})();
