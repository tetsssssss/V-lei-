/* V3.1 · schedule.js — cronograma do dia: ordenação, conflitos e modelo SUGERIDO (editável) a partir do horário da cerimônia. */
(function (root, factory) {
  const api = factory(root.V31 || (root.V31 = {}));
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (V31) {
  'use strict';
  const D = V31.data;
  function validate(it) {
    if (D.toMin(it.start) === null) throw new Error('Horário inválido (use HH:MM).');
    const m = Math.floor(D.num(it.minutes, 0)); if (m < 0 || m > 24 * 60) throw new Error('Duração inválida.');
    if (!String(it.title || '').trim()) throw new Error('Dê um nome ao momento.');
    return { start: it.start, minutes: m, title: String(it.title).trim().slice(0, 80), where: it.where || '', who: String(it.who || '').slice(0, 80), note: String(it.note || '').slice(0, 300), kind: it.kind || '' };
  }
  function add(d, it) { const v = D.ensure(d), x = { id: D.uid('dia'), ...validate(it) }; v.dayPlan.push(x); return x; }
  function update(d, id, patch) { const v = D.ensure(d), x = v.dayPlan.find(i => i.id === id); if (!x) throw new Error('Momento não encontrado.'); Object.assign(x, validate({ ...x, ...patch })); return x; }
  function remove(d, id) { const v = D.ensure(d), n = v.dayPlan.length; v.dayPlan = v.dayPlan.filter(i => i.id !== id); return v.dayPlan.length < n; }
  /** Ordena e acha sobreposições (fim de um > início do próximo) e folgas longas (> gapMin). */
  function analyze(list, gapMin = 90) {
    const items = list.map(i => ({ ...i, s: D.toMin(i.start), e: D.toMin(i.start) + D.num(i.minutes) })).filter(i => i.s !== null).sort((a, b) => a.s - b.s || a.e - b.e);
    const overlaps = [], gaps = [];
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i], b = items[i + 1];
      if (a.e > b.s && a.minutes > 0) overlaps.push({ a, b, minutes: a.e - b.s });
      else if (b.s - a.e >= gapMin) gaps.push({ a, b, minutes: b.s - a.e });
    }
    return { items, overlaps, gaps, first: items[0] || null, last: items.length ? items.reduce((x, y) => (y.e > x.e ? y : x)) : null };
  }
  /** Modelo SUGERIDO. Os offsets são um ponto de partida típico, não uma regra: o casal/cerimonialista ajusta. */
  const TEMPLATE = [
    [-180, 60, 'Montagem final e conferência da decoração', 'montagem'], [-120, 90, 'Preparação e fotos dos noivos', 'preparacao'], [-45, 45, 'Recepção dos convidados', 'recepcao'],
    [-5, 5, 'Entrada do cortejo', 'cerimonia'], [0, 40, 'Cerimônia', 'cerimonia'], [40, 30, 'Cumprimentos e fotos em família', 'fotos'], [70, 60, 'Coquetel / mesa de frios', 'coquetel'],
    [130, 20, 'Entrada dos noivos na festa', 'festa'], [150, 90, 'Jantar / buffet', 'jantar'], [240, 120, 'Pista de dança', 'festa'], [360, 30, 'Encerramento e saída', 'encerramento'],
  ];
  function suggest(ceremonyTime) {
    const c = D.toMin(ceremonyTime); if (c === null) throw new Error('Informe o horário da cerimônia (HH:MM).');
    return TEMPLATE.map(([off, minutes, title, kind]) => ({ start: D.hhmm(c + off), minutes, title, kind, where: '', who: '', note: 'Modelo sugerido — ajuste.' })).filter((_, i, a) => D.toMin(a[i].start) !== null);
  }
  Object.assign(V31, { schedule: { validate, add, update, remove, analyze, suggest } });
  return V31.schedule;
});
