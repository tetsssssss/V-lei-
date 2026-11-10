/* Íris · charts.js — gráficos em SVG/DOM próprios (sem bibliotecas, funcionam offline).
   Parte PURA (modelos numéricos, testável em Node) + construtores de DOM (navegador).
   Todo gráfico tem role="img", <title>/<desc> e uma tabela de dados acessível (.iris-vh). */
(function (root, factory) {
  const api = factory(root.Iris || (root.Iris = {}), root);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Iris, root) {
  'use strict';

  // ============================ MODELOS (puros) ============================
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct = (v, total) => (total > 0 ? clamp(v / total * 100, 0, 100) : 0);

  /** Fatias de rosca: ordem preservada, fatias com valor 0 omitidas; ângulos somam 360 (ou 0 sem dados). */
  function donutModel(items) {
    const clean = items.map(i => ({ ...i, value: Math.max(0, Number(i.value) || 0) })).filter(i => i.value > 0);
    const total = clean.reduce((a, i) => a + i.value, 0);
    let a = 0;
    const slices = clean.map(i => { const share = i.value / total, span = share * 360; const s = { ...i, pct: share * 100, start: a, end: a + span }; a += span; return s; });
    return { total, slices };
  }
  /** Anel de progresso: 0–100. */
  const ringModel = (value, total) => ({ pct: pct(value, total), value, total });
  /** Medidor: planejado × teto; `over` quando ultrapassa; sem teto → state "sem-teto". */
  function gaugeModel(planned, limit, reserve = 0) {
    if (!limit || limit <= 0) return { state: 'sem-teto', pct: 0, over: false };
    const usable = Math.max(0, limit - reserve);
    return { state: planned > usable ? 'acima' : 'ok', pct: pct(planned, limit), usablePct: pct(usable, limit), over: planned > usable };
  }
  /** Linha do tempo semanal até a data: semanas restantes e posição de marcos (0–100). */
  function timelineModel(todayMs, endMs, marks = []) {
    const total = Math.max(1, endMs - todayMs);
    return { weeksLeft: Math.max(0, Math.ceil((endMs - todayMs) / (7 * 86400000))), marks: marks.map(m => ({ ...m, pos: clamp((m.ms - todayMs) / total * 100, 0, 100), past: m.ms < todayMs })) };
  }
  /** Pipeline de fornecedores: contagem por etapa, na ordem natural do processo. */
  const STAGES = ['Pesquisando', 'Proposta recebida', 'Em negociação', 'Fechado', 'Descartado'];
  function pipelineModel(vendors) { return STAGES.map(s => ({ stage: s, count: vendors.filter(v => v.status === s).length })); }

  // ============================ DOM (navegador) ============================
  const NS = 'http://www.w3.org/2000/svg';
  const doc = () => root.document;
  const svg = (tag, attrs = {}, ...kids) => { const e = doc().createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, String(v)); kids.flat().forEach(k => k && e.append(k.nodeType ? k : doc().createTextNode(String(k)))); return e; };
  const html = (tag, attrs = {}, ...kids) => Iris.dom.h(tag, attrs, ...kids);
  const reduced = () => { try { return root.matchMedia('(prefers-reduced-motion: reduce)').matches || doc().documentElement.getAttribute('data-iris-motion') === 'off'; } catch (_) { return false; } };
  const raf = f => (root.requestAnimationFrame ? root.requestAnimationFrame(f) : setTimeout(f, 16));

  /** Tabela acessível equivalente ao gráfico (leitores de tela). */
  function dataTable(caption, rows) {
    // <div> oculto envolve a tabela: <table> ignora width:1px e criaria rolagem horizontal fantasma.
    return html('div', { class: 'iris-vh' }, html('table', {}, html('caption', { text: caption }), html('tbody', {}, ...rows.map(r => html('tr', {}, html('th', { scope: 'row', text: r[0] }), html('td', { text: String(r[1]) }))))));
  }
  const wrap = (title, desc, node, rows) => html('figure', { class: 'ic-fig' }, node, rows ? dataTable(title, rows) : null);

  function ring({ pct: p, size = 132, stroke = 12, color = 'var(--i-chart-1)', big = '', small = '', bigSize = 28, title = 'Progresso', desc = '' }) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - p / 100);
    const arc = svg('circle', { class: 'ic-arc', cx: size / 2, cy: size / 2, r, fill: 'none', stroke: color, 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': reduced() ? off : c, transform: `rotate(-90 ${size / 2} ${size / 2})` });
    if (!reduced()) raf(() => raf(() => arc.setAttribute('stroke-dashoffset', off)));
    const s = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': `${title}: ${desc || Math.round(p) + '%'}` },
      svg('title', {}, title), svg('desc', {}, desc || `${Math.round(p)}%`),
      svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--i-line)', 'stroke-width': stroke }), arc,
      big ? svg('text', { x: size / 2, y: size / 2 + (small ? -2 : 8), 'text-anchor': 'middle', class: 'ic-big', style: `font-size:${bigSize}px` }, big) : null,
      small ? svg('text', { x: size / 2, y: size / 2 + 20, 'text-anchor': 'middle', class: 'ic-small' }, small) : null);
    return wrap(title, desc, s, [[title, desc || Math.round(p) + '%']]);
  }

  function donut({ items, size = 150, stroke = 24, bigText = '', smallText = '', bigSize = 26, title = 'Distribuição', emptyText = 'Sem dados ainda' }) {
    const m = donutModel(items), r = (size - stroke) / 2, c = 2 * Math.PI * r, cx = size / 2;
    const kids = [svg('title', {}, title), svg('circle', { cx, cy: cx, r, fill: 'none', stroke: 'var(--i-line)', 'stroke-width': stroke })];
    const gap = m.slices.length > 1 ? 2.5 : 0;
    m.slices.forEach(sl => {
      const len = Math.max(0, c * (sl.end - sl.start) / 360 - gap), arc = svg('circle', { class: 'ic-arc', cx, cy: cx, r, fill: 'none', stroke: sl.color, 'stroke-width': stroke, 'stroke-dasharray': `${reduced() ? len : 0} ${c}`, transform: `rotate(${sl.start - 90} ${cx} ${cx})` });
      if (!reduced()) raf(() => raf(() => arc.setAttribute('stroke-dasharray', `${len} ${c}`)));
      arc.append(svg('title', {}, `${sl.label}: ${sl.value} (${Math.round(sl.pct)}%)`)); kids.push(arc);
    });
    kids.push(svg('text', { x: cx, y: cx + (smallText ? -2 : 8), 'text-anchor': 'middle', class: 'ic-big', style: `font-size:${bigSize}px` }, m.total ? bigText : '—'), svg('text', { x: cx, y: cx + 20, 'text-anchor': 'middle', class: 'ic-small' }, m.total ? smallText : emptyText));
    const s = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': `${title}: ${m.slices.map(x => `${x.label} ${x.value}`).join(', ') || emptyText}` }, ...kids);
    const legend = html('ul', { class: 'ic-legend' }, ...m.slices.map(sl => html('li', {}, html('i', { style: { background: sl.color }, 'aria-hidden': 'true' }), html('span', { text: sl.label }), html('b', { text: String(sl.text ?? sl.value) }))));
    return html('figure', { class: 'ic-fig ic-donut' }, s, legend, dataTable(title, m.slices.map(x => [x.label, `${x.text ?? x.value} (${Math.round(x.pct)}%)`])));
  }

  /** Barras horizontais com rótulo e valor em texto (legível sem cor). items: {label, value, max?, color, text} */
  function hbars({ items, title = 'Comparativo', max }) {
    const top = max || Math.max(1, ...items.map(i => i.max || i.value));
    const rows = items.map(i => { const w = pct(i.value, i.max || top); const fill = html('i', { class: 'ic-fill', style: { background: i.color || 'var(--i-chart-1)', width: reduced() ? w + '%' : '0%' } }); if (!reduced()) raf(() => raf(() => { fill.style.width = w + '%'; }));
      return html('div', { class: 'ic-bar' }, html('span', { class: 'ic-bar-l', text: i.label }), html('span', { class: 'ic-track', 'aria-hidden': 'true' }, fill), html('b', { class: 'ic-bar-v', text: i.text ?? String(i.value) })); });
    return html('figure', { class: 'ic-fig', role: 'group', 'aria-label': title }, ...rows, dataTable(title, items.map(i => [i.label, i.text ?? i.value])));
  }

  /** Medidor semicircular (planejado × teto). */
  function gauge({ model, big, small, bigSize = 22, title = 'Orçamento', size = 260 }) {
    const w = size, hgt = size * .5, r = size * .4, cx = w / 2, cy = hgt - 8, len = Math.PI * r;
    const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    const fillLen = len * model.pct / 100;
    const arc = svg('path', { class: 'ic-arc', d, fill: 'none', stroke: model.over ? 'var(--i-danger)' : 'var(--i-chart-1)', 'stroke-width': 16, 'stroke-linecap': 'round', 'stroke-dasharray': `${reduced() ? fillLen : 0} ${len}` });
    if (!reduced()) raf(() => raf(() => arc.setAttribute('stroke-dasharray', `${fillLen} ${len}`)));
    const mark = model.usablePct !== undefined ? (() => { const a = Math.PI * (1 - model.usablePct / 100); return svg('line', { x1: cx + (r - 14) * Math.cos(a), y1: cy - (r - 14) * Math.sin(a), x2: cx + (r + 14) * Math.cos(a), y2: cy - (r + 14) * Math.sin(a), stroke: 'var(--i-muted)', 'stroke-width': 2 }); })() : null;
    const s = svg('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, role: 'img', 'aria-label': `${title}: ${small}` }, svg('title', {}, title), svg('desc', {}, small),
      svg('path', { d, fill: 'none', stroke: 'var(--i-line)', 'stroke-width': 16, 'stroke-linecap': 'round' }), arc, mark,
      svg('text', { x: cx, y: cy - 26, 'text-anchor': 'middle', class: 'ic-big', style: `font-size:${bigSize}px` }, big), svg('text', { x: cx, y: cy - 6, 'text-anchor': 'middle', class: 'ic-small' }, small));
    return wrap(title, small, s, [[title, `${big} — ${small}`]]);
  }

  /** Funil/pipeline em etapas (texto em cada etapa; não depende só de cor). */
  function pipeline(stages, title = 'Etapas') {
    const total = stages.reduce((a, s) => a + s.count, 0);
    return html('figure', { class: 'ic-fig', role: 'group', 'aria-label': title },
      html('ol', { class: 'ic-pipe' }, ...stages.map((s, i) => html('li', { class: s.count ? 'on' : '' }, html('b', { text: String(s.count) }), html('span', { text: s.stage })))),
      dataTable(title, stages.map(s => [s.stage, s.count])), total ? null : null);
  }

  /** Linha do tempo até a data de referência. */
  function timeline({ model, title = 'Até o grande dia', startLabel = 'Hoje', endLabel = 'Data de referência' }) {
    const W = 320, H = 64, y = 30;
    const marks = model.marks.map(m => svg('g', {}, svg('circle', { cx: 12 + (W - 24) * m.pos / 100, cy: y, r: 6, fill: m.done ? 'var(--i-ok)' : m.past ? 'var(--i-danger)' : 'var(--i-chart-2)', stroke: 'var(--i-surface)', 'stroke-width': 2 }, svg('title', {}, `${m.label}${m.past && !m.done ? ' (prazo vencido)' : ''}`))));
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': `${title}: faltam ${model.weeksLeft} semanas`, preserveAspectRatio: 'xMidYMid meet' }, svg('title', {}, title), svg('desc', {}, `${model.weeksLeft} semanas restantes`),
      svg('line', { x1: 12, y1: y, x2: W - 12, y2: y, stroke: 'var(--i-line)', 'stroke-width': 4, 'stroke-linecap': 'round' }),
      svg('circle', { cx: 12, cy: y, r: 7, fill: 'var(--i-chart-1)' }), svg('circle', { cx: W - 12, cy: y, r: 7, fill: 'var(--i-glow)', stroke: 'var(--i-chart-1)', 'stroke-width': 2 }), ...marks,
      svg('text', { x: 12, y: 56, class: 'ic-small', 'text-anchor': 'start' }, startLabel), svg('text', { x: W - 12, y: 56, class: 'ic-small', 'text-anchor': 'end' }, endLabel));
    return wrap(title, `${model.weeksLeft} semanas`, s, [[title, `${model.weeksLeft} semanas restantes`], ...model.marks.map(m => [m.label, m.past ? 'prazo vencido' : 'a vencer'])]);
  }

  /** Contagem animada de números (respeita movimento reduzido). */
  function countUp(el, to, fmt = v => String(Math.round(v)), ms = 700) {
    if (reduced() || !root.requestAnimationFrame) { el.textContent = fmt(to); return; }
    const t0 = root.performance.now(); const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) root.requestAnimationFrame(step); }; root.requestAnimationFrame(step);
  }

  /** R$ compacto para caber no centro de gráficos: 21800 → "R$ 21,8 mil". */
  const compactBRL = v => { const n = Number(v) || 0, f = (x, u) => `R$ ${(Math.round(x * 10) / 10).toString().replace('.', ',')} ${u}`; return n >= 1e6 ? f(n / 1e6, 'mi') : n >= 1e4 ? f(n / 1e3, 'mil') : `R$ ${Math.round(n).toLocaleString('pt-BR')}`; };

  const api = { compactBRL, clamp, pct, donutModel, ringModel, gaugeModel, timelineModel, pipelineModel, STAGES, dataTable, ring, donut, hbars, gauge, pipeline, timeline, countUp };
  Iris.charts = api;
  return api;
});
